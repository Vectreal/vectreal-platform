import { and, eq, inArray, isNull } from 'drizzle-orm'

import { generateApiKey } from './api-key-generator.server'
import { resolveApiKeyState } from './api-key-lifecycle'
import { getDbClient } from '../../../db/client'
import { apiKeyProjects } from '../../../db/schema/auth/api-key-projects'
import { apiKeys } from '../../../db/schema/auth/api-keys'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { organizations } from '../../../db/schema/core/organizations'
import { users } from '../../../db/schema/core/users'
import { projects } from '../../../db/schema/project/projects'
import {
	getOrgSubscription,
	getRecommendedUpgrade
} from '../billing/entitlement-service.server'
import { QuotaExceededError } from '../billing/quota-exceeded-error'
import { checkQuota } from '../billing/usage-service.server'
import { type DashboardOperation } from '../dashboard/dashboard-operations'
import { assertDashboardPermission } from '../dashboard/dashboard-permissions.server'

const db = getDbClient()

type DbClient = typeof db

/** The operations this module is allowed to assert. */
type ApiKeyOperation = Extract<DashboardOperation, `api-key:${string}`>

/**
 * Verify the actor may perform `operation` in this organization.
 *
 * The operation is a parameter rather than a constant because this function
 * used to assert `api-key:create` for create, update *and* revoke. That was
 * inert only because the three role lists happen to be identical: the moment
 * one of them tightened, `dashboard-operations.ts` would have described a rule
 * this path does not enforce, and that table is the only authorization that
 * runs in this app - `db/client.ts` connects without `set local role`, so every
 * RLS policy is bypassed.
 */
async function verifyOrganizationAdminAccess(
	dbClient: DbClient,
	organizationId: string,
	userId: string,
	operation: ApiKeyOperation
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

	assertDashboardPermission(operation, { role: membership[0].role })

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

	assertDashboardPermission('api-key:read', { role: membership.role })

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
	await verifyOrganizationAdminAccess(
		db,
		organizationId,
		userId,
		'api-key:create'
	)

	const quotaCheck = await checkQuota(organizationId, 'api_keys_per_org')
	if (quotaCheck.outcome === 'hard_limit_exceeded') {
		const { plan } = await getOrgSubscription(organizationId)
		const upgradeTo = getRecommendedUpgrade(plan)
		throw new QuotaExceededError({
			limitKey: 'api_keys_per_org',
			currentValue: quotaCheck.currentValue,
			limit: quotaCheck.limit,
			plan,
			upgradeTo,
			message:
				'API key limit reached for your plan. Upgrade to create more API keys.'
		})
	}

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

	await verifyOrganizationAdminAccess(
		db,
		existingKey.organization.id,
		userId,
		'api-key:update'
	)

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
 * Replace the secret behind an existing key, keeping the row.
 *
 * This is the only way to fix a key that has leaked without breaking every
 * embed at once: the id, name, description, project links and expiry all
 * survive, so the owner updates one snippet rather than re-minting and
 * re-scoping a key everywhere it was pasted. Before this existed the only
 * remedy was revoke-and-recreate, which is why a token published in the
 * marketing bundle sat unrotated.
 *
 * Refused on any key that is not live. A revoked key must stay dead, and a
 * rotated-but-expired key would hand back a fresh secret that still cannot
 * authorize anything.
 */
export async function rotateApiKey(params: {
	apiKeyId: string
	userId: string
}): Promise<ApiKeyWithDetails & { plaintext: string }> {
	const { apiKeyId, userId } = params

	const existingKey = await getApiKeyById(apiKeyId, userId)
	if (!existingKey) {
		throw new Error('API key not found or access denied')
	}

	await verifyOrganizationAdminAccess(
		db,
		existingKey.organization.id,
		userId,
		'api-key:rotate'
	)

	const state = resolveApiKeyState(existingKey.apiKey, new Date())
	if (state !== 'active') {
		throw new Error(
			`This API key is ${state} and cannot be rotated. Create a new key instead.`
		)
	}

	const { plaintext, hashed, preview } = generateApiKey()

	/*
	  A compare-and-swap on the secret that was read, not a blind write by id.

	  Two things can land between the read above and this write, and both would
	  otherwise be reported to the caller as a successful rotation:

	    - a revoke, leaving a fresh secret on a row its owner just killed;
	    - another rotation, after which only the last writer's plaintext is live
	      while every earlier caller has already been handed one that authorizes
	      nothing. Two admins reacting to the same leaked key, or one
	      double-submitted form, is enough.

	  Matching on the old `hashedKey` makes the loser update zero rows, so it
	  raises instead of returning a dead secret.
	*/
	const rotated = await db
		.update(apiKeys)
		.set({
			hashedKey: hashed,
			keyPreview: preview,
			rotatedAt: new Date(),
			/*
			  The old secret's usage history does not describe the new one. Left
			  alone it would read as "already in use" the moment the key is minted,
			  and that field is exactly what an owner checks to confirm the
			  storefront picked the new key up.
			*/
			lastUsedAt: null
		})
		.where(
			and(
				eq(apiKeys.id, apiKeyId),
				eq(apiKeys.hashedKey, existingKey.apiKey.hashedKey),
				isNull(apiKeys.revokedAt)
			)
		)
		.returning({ id: apiKeys.id })

	if (rotated.length === 0) {
		throw new Error(
			'This API key changed while it was being rotated - it was revoked, or rotated somewhere else. Reload and check its state before trying again.'
		)
	}

	const updatedKey = await getApiKeyById(apiKeyId, userId)
	if (!updatedKey) {
		throw new Error('Failed to retrieve rotated API key')
	}

	return { ...updatedKey, plaintext }
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

	await verifyOrganizationAdminAccess(
		db,
		existingKey.organization.id,
		userId,
		'api-key:revoke'
	)

	// Set revokedAt timestamp
	await db
		.update(apiKeys)
		.set({
			revokedAt: new Date(),
			active: false
		})
		.where(eq(apiKeys.id, apiKeyId))
}
