
import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { organizations } from '../../../db/schema/core/organizations'
import { users } from '../../../db/schema/core/users'
import { projects } from '../../../db/schema/project/projects'

import type { User } from '@supabase/supabase-js'

export interface CreateUserParams {
	readonly id: string
	readonly email: string
	readonly name?: string
}

export interface UserWithDefaults {
	readonly user: typeof users.$inferSelect
	readonly organization: typeof organizations.$inferSelect
	readonly project: typeof projects.$inferSelect
}

const db = getDbClient()

type DbClient = typeof db

async function ensureUserExistsDb(
	dbClient: DbClient,
	supabaseUser: User
): Promise<typeof users.$inferSelect> {
	const existingUser = await dbClient
		.select()
		.from(users)
		.where(eq(users.id, supabaseUser.id))
		.limit(1)

	if (existingUser.length > 0) {
		return existingUser[0]
	}

	const [newUser] = await dbClient
		.insert(users)
		.values({
			id: supabaseUser.id,
			email: supabaseUser.email || '',
			name: supabaseUser.user_metadata?.name || supabaseUser.email || 'User'
		})
		.returning()

	return newUser
}

async function createOrganizationDb(
	dbClient: DbClient,
	userId: string,
	name: string
): Promise<typeof organizations.$inferSelect> {
	const [organization] = await dbClient
		.insert(organizations)
		.values({
			name,
			ownerId: userId
		})
		.returning()

	await dbClient.insert(organizationMemberships).values({
		userId,
		organizationId: organization.id,
		role: 'owner'
	})

	return organization
}

async function getOrCreateDefaultOrganizationDb(
	dbClient: DbClient,
	userId: string
): Promise<typeof organizations.$inferSelect> {
	const existingOrg = await dbClient
		.select({ organization: organizations })
		.from(organizations)
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, organizations.id)
		)
		.where(
			and(
				eq(organizationMemberships.userId, userId),
				eq(organizationMemberships.role, 'owner'),
				eq(organizations.name, 'My Organization')
			)
		)
		.limit(1)
		.then((rows) => rows[0]?.organization)

	if (existingOrg) {
		return existingOrg
	}

	return await createOrganizationDb(dbClient, userId, 'My Organization')
}

async function getUserOrganizationMembershipDb(
	dbClient: DbClient,
	userId: string,
	organizationId: string
): Promise<typeof organizationMemberships.$inferSelect | null> {
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

	return membership[0] || null
}

async function getOrCreateDefaultProjectDb(
	dbClient: DbClient,
	userId: string,
	organizationId?: string
): Promise<typeof projects.$inferSelect> {
	let orgId = organizationId
	if (!orgId) {
		const org = await getOrCreateDefaultOrganizationDb(dbClient, userId)
		orgId = org.id
	}

	const membership = await getUserOrganizationMembershipDb(
		dbClient,
		userId,
		orgId
	)
	if (!membership) {
		throw new Error('User does not have permission to access this organization')
	}

	let project = await dbClient
		.select()
		.from(projects)
		.where(eq(projects.organizationId, orgId))
		.limit(1)
		.then((rows) => rows[0])

	if (!project) {
		const [newProject] = await dbClient
			.insert(projects)
			.values({
				organizationId: orgId,
				name: 'My Project',
				slug: `my-project-${userId.slice(0, 8)}`
			})
			.returning()
		project = newProject
	}

	return project
}

export async function ensureUserExists(
	supabaseUser: User
): Promise<typeof users.$inferSelect> {
	try {
		return await ensureUserExistsDb(db, supabaseUser)
	} catch (error) {
		console.error('Database error in ensureUserExists:', {
			error,
			userId: supabaseUser.id,
			userEmail: supabaseUser.email,
			userName: supabaseUser.user_metadata?.name
		})
		throw error
	}
}

export async function createOrganization(
	userId: string,
	name: string
): Promise<typeof organizations.$inferSelect> {
	return db.transaction(async (tx) => {
		return await createOrganizationDb(tx as DbClient, userId, name)
	})
}

export async function getOrCreateDefaultOrganization(
	userId: string
): Promise<typeof organizations.$inferSelect> {
	return await getOrCreateDefaultOrganizationDb(db, userId)
}

export async function getUserOrganizations(userId: string): Promise<
	Array<{
		organization: typeof organizations.$inferSelect
		membership: typeof organizationMemberships.$inferSelect
	}>
> {
	return await db
		.select({
			organization: organizations,
			membership: organizationMemberships
		})
		.from(organizations)
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, organizations.id)
		)
		.where(eq(organizationMemberships.userId, userId))
		.orderBy(organizationMemberships.joinedAt)
}

export async function getUserOrganizationMembership(
	userId: string,
	organizationId: string
): Promise<typeof organizationMemberships.$inferSelect | null> {
	return await getUserOrganizationMembershipDb(db, userId, organizationId)
}

export async function addUserToOrganization(
	userId: string,
	organizationId: string,
	role: 'owner' | 'admin' | 'member' = 'member',
	invitedBy?: string
): Promise<typeof organizationMemberships.$inferSelect> {
	const existingMembership = await getUserOrganizationMembership(
		userId,
		organizationId
	)

	if (existingMembership) {
		throw new Error('User is already a member of this organization')
	}

	const [membership] = await db
		.insert(organizationMemberships)
		.values({
			userId,
			organizationId,
			role,
			invitedBy
		})
		.returning()

	return membership
}

export async function getOrCreateDefaultProject(
	userId: string,
	organizationId?: string
): Promise<typeof projects.$inferSelect> {
	return await getOrCreateDefaultProjectDb(db, userId, organizationId)
}

export async function initializeUserDefaults(
	supabaseUser: User
): Promise<UserWithDefaults> {
	return await db.transaction(async (tx) => {
		const user = await ensureUserExistsDb(tx as DbClient, supabaseUser)
		const organization = await getOrCreateDefaultOrganizationDb(
			tx as DbClient,
			user.id
		)
		const project = await getOrCreateDefaultProjectDb(
			tx as DbClient,
			user.id,
			organization.id
		)

		return {
			user,
			organization,
			project
		}
	})
}

export async function getUserWithDefaultProject(
	userId: string
): Promise<{ user: typeof users.$inferSelect; projectId: string } | null> {
	const user = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)
		.then((rows) => rows[0])

	if (!user) return null

	const project = await getOrCreateDefaultProject(userId)

	return {
		user,
		projectId: project.id
	}
}

export async function userExists(userId: string): Promise<boolean> {
	const user = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)

	return user.length > 0
}
