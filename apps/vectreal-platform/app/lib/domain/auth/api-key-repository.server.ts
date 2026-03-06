import { and, eq, inArray } from 'drizzle-orm'

import { generateApiKey } from './api-key-generator.server'
import { getDbClient } from '../../../db/client'
import { apiKeyProjects } from '../../../db/schema/auth/api-key-projects'
import { apiKeys } from '../../../db/schema/auth/api-keys'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { organizations } from '../../../db/schema/core/organizations'
import { users } from '../../../db/schema/core/users'
import { projects } from '../../../db/schema/project/projects'

const db = getDbClient()

type DbClient = typeof db

/**
 * Verify user is an admin or owner of the organization
 */
async function verifyOrganizationAdminAccess(
	dbClient: DbClient,
	organizationId: string,
	userId: string
): Promise<typeof organizationMemberships.$inferSelect> {
	const membership = await dbClient
		.select()
		.from(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.organizationId, organizationId)
			)
		)
		.limit(1)

	if (membership.length === 0) {
		throw new Error('User does not have access to this organization')
	}

	if (!['admin', 'owner'].includes(membership[0].role)) {
		throw new Error('Insufficient permissions. Admin or owner role required.')
	}

	return membership[0]
}

/**
 * Verify all project IDs belong to the specified organization
 */
async function verifyProjectsInOrganization(
	dbClient: DbClient,
	projectIds: string[],
	organizationId: string
): Promise<void> {
	if (projectIds.length === 0) {
		throw new Error('At least one project must be selected')
	}

	const validProjects = await dbClient
		.select({ id: projects.id })
		.from(projects)
		.where(
			and(
				inArray(projects.id, projectIds),
				eq(projects.organizationId, organizationId)
			)
		)

	if (validProjects.length !== projectIds.length) {
		throw new Error('One or more projects do not belong to this organization')
	}
}

export interface ApiKeyWithDetails {
	apiKey: typeof apiKeys.$inferSelect
	creator: Pick<typeof users.$inferSelect, 'id' | 'name' | 'email'>
	organization: Pick<typeof organizations.$inferSelect, 'id' | 'name'>
	projects: Array<{
		id: string
		name: string
		slug: string
	}>
}

/**
 * Get all API keys for all organizations the user belongs to (admin/owner only)
 */
export async function getAllUserApiKeys(
	userId: string
): Promise<ApiKeyWithDetails[]> {
	// Get all organizations where user is admin or owner
	const userOrgs = await db
		.select({ organizationId: organizationMemberships.organizationId })
		.from(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.userId, userId),
				inArray(organizationMemberships.role, ['admin', 'owner'])
			)
		)

	const orgIds = userOrgs.map((o) => o.organizationId)

	if (orgIds.length === 0) {
		return []
	}

	// Get all API keys for those organizations
	const keysData = await db
		.select({
			apiKey: apiKeys,
			creator: {
				id: users.id,
				name: users.name,
				email: users.email
			},
			organization: {
				id: organizations.id,
				name: organizations.name
			}
		})
		.from(apiKeys)
		.innerJoin(users, eq(users.id, apiKeys.userId))
		.innerJoin(organizations, eq(organizations.id, apiKeys.organizationId))
		.where(inArray(apiKeys.organizationId, orgIds))
		.orderBy(apiKeys.createdAt)

	// Get projects for each API key
	const keyIds = keysData.map((k) => k.apiKey.id)
	const projectMappings = keyIds.length
		? await db
				.select({
					apiKeyId: apiKeyProjects.apiKeyId,
					project: {
						id: projects.id,
						name: projects.name,
						slug: projects.slug
					}
				})
				.from(apiKeyProjects)
				.innerJoin(projects, eq(projects.id, apiKeyProjects.projectId))
				.where(inArray(apiKeyProjects.apiKeyId, keyIds))
		: []

	// Group projects by API key ID
	const projectsByKeyId = new Map<string, ApiKeyWithDetails['projects']>()
	for (const mapping of projectMappings) {
		if (!projectsByKeyId.has(mapping.apiKeyId)) {
			projectsByKeyId.set(mapping.apiKeyId, [])
		}
		projectsByKeyId.get(mapping.apiKeyId)!.push(mapping.project)
	}

	// Combine data
	return keysData.map((data) => ({
		apiKey: data.apiKey,
		creator: data.creator,
		organization: data.organization,
		projects: projectsByKeyId.get(data.apiKey.id) || []
	}))
}

/**
 * Get a single API key by ID (with access verification)
 */
export async function getApiKeyById(
	apiKeyId: string,
	userId: string
): Promise<ApiKeyWithDetails | null> {
	const keyData = await db
		.select({
			apiKey: apiKeys,
			creator: {
				id: users.id,
				name: users.name,
				email: users.email
			},
			organization: {
				id: organizations.id,
				name: organizations.name
			},
			membership: organizationMemberships
		})
		.from(apiKeys)
		.innerJoin(users, eq(users.id, apiKeys.userId))
		.innerJoin(organizations, eq(organizations.id, apiKeys.organizationId))
		.innerJoin(
			organizationMemberships,
			and(
				eq(organizationMemberships.organizationId, apiKeys.organizationId),
				eq(organizationMemberships.userId, userId)
			)
		)
		.where(eq(apiKeys.id, apiKeyId))
		.limit(1)

	if (keyData.length === 0) {
		return null
	}

	const { apiKey, creator, organization, membership } = keyData[0]

	// Verify user has admin/owner access
	if (!['admin', 'owner'].includes(membership.role)) {
		throw new Error('Insufficient permissions to view this API key')
	}

	// Get associated projects
	const projectMappings = await db
		.select({
			project: {
				id: projects.id,
				name: projects.name,
				slug: projects.slug
			}
		})
		.from(apiKeyProjects)
		.innerJoin(projects, eq(projects.id, apiKeyProjects.projectId))
		.where(eq(apiKeyProjects.apiKeyId, apiKeyId))

	return {
		apiKey,
		creator,
		organization,
		projects: projectMappings.map((m) => m.project)
	}
}

export interface CreateApiKeyParams {
	userId: string
	organizationId: string
	name: string
	description?: string
	projectIds: string[]
	expiresAt?: Date | null
}

/**
 * Create a new API key
 * @returns The created key details with plaintext key (only time it's accessible)
 */
export async function createApiKey(
	params: CreateApiKeyParams
): Promise<ApiKeyWithDetails & { plaintext: string }> {
	const { userId, organizationId, name, description, projectIds, expiresAt } =
		params

	// Verify user is admin/owner of organization
	await verifyOrganizationAdminAccess(db, organizationId, userId)

	// Verify all projects belong to organization
	await verifyProjectsInOrganization(db, projectIds, organizationId)

	// Generate API key
	const { plaintext, hashed, preview } = generateApiKey()

	// Insert API key
	const [newKey] = await db
		.insert(apiKeys)
		.values({
			userId,
			organizationId,
			name,
			description: description || null,
			hashedKey: hashed,
			keyPreview: preview,
			active: true,
			expiresAt: expiresAt || null
		})
		.returning()

	// Insert project mappings
	await db.insert(apiKeyProjects).values(
		projectIds.map((projectId) => ({
			apiKeyId: newKey.id,
			projectId
		}))
	)

	// Fetch creator and organization details
	const [creator] = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email
		})
		.from(users)
		.where(eq(users.id, userId))

	const [organization] = await db
		.select({
			id: organizations.id,
			name: organizations.name
		})
		.from(organizations)
		.where(eq(organizations.id, organizationId))

	// Fetch project details
	const projectDetails = await db
		.select({
			id: projects.id,
			name: projects.name,
			slug: projects.slug
		})
		.from(projects)
		.where(inArray(projects.id, projectIds))

	return {
		apiKey: newKey,
		creator,
		organization,
		projects: projectDetails,
		plaintext // Only returned on creation
	}
}

export interface UpdateApiKeyParams {
	apiKeyId: string
	userId: string
	name?: string
	description?: string
	projectIds?: string[]
}

/**
 * Update an existing API key (name, description, and/or projects)
 */
export async function updateApiKey(
	params: UpdateApiKeyParams
): Promise<ApiKeyWithDetails> {
	const { apiKeyId, userId, name, description, projectIds } = params

	// Get existing key and verify access
	const existingKey = await getApiKeyById(apiKeyId, userId)
	if (!existingKey) {
		throw new Error('API key not found or access denied')
	}

	// Verify user is admin/owner
	await verifyOrganizationAdminAccess(db, existingKey.organization.id, userId)

	// If projectIds provided, verify they belong to organization
	if (projectIds && projectIds.length > 0) {
		await verifyProjectsInOrganization(
			db,
			projectIds,
			existingKey.organization.id
		)
	}

	// Update API key metadata if provided
	if (name !== undefined || description !== undefined) {
		const updates: Partial<typeof apiKeys.$inferSelect> = {}
		if (name !== undefined) updates.name = name
		if (description !== undefined) updates.description = description

		await db.update(apiKeys).set(updates).where(eq(apiKeys.id, apiKeyId))
	}

	// Update project mappings if provided
	if (projectIds && projectIds.length > 0) {
		// Delete existing mappings
		await db.delete(apiKeyProjects).where(eq(apiKeyProjects.apiKeyId, apiKeyId))

		// Insert new mappings
		await db.insert(apiKeyProjects).values(
			projectIds.map((projectId) => ({
				apiKeyId,
				projectId
			}))
		)
	}

	// Fetch and return updated key
	const updatedKey = await getApiKeyById(apiKeyId, userId)
	if (!updatedKey) {
		throw new Error('Failed to retrieve updated API key')
	}

	return updatedKey
}

/**
 * Revoke an API key (sets revokedAt timestamp)
 */
export async function revokeApiKey(
	apiKeyId: string,
	userId: string
): Promise<void> {
	// Get key and verify access
	const existingKey = await getApiKeyById(apiKeyId, userId)
	if (!existingKey) {
		throw new Error('API key not found or access denied')
	}

	// Verify user is admin/owner
	await verifyOrganizationAdminAccess(db, existingKey.organization.id, userId)

	// Set revokedAt timestamp
	await db
		.update(apiKeys)
		.set({
			revokedAt: new Date(),
			active: false
		})
		.where(eq(apiKeys.id, apiKeyId))
}
