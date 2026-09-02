import { and, eq, or } from 'drizzle-orm'

export interface ProfileUpdateData {
	role?: string | null
	useCase?: string | null
	companyName?: string | null
	referralSource?: string | null
}

import { getDbClient } from '../../../db/client'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { organizations } from '../../../db/schema/core/organizations'
import { users } from '../../../db/schema/core/users'
import { assets } from '../../../db/schema/project/assets'
import { folders } from '../../../db/schema/project/folders'
import { projects } from '../../../db/schema/project/projects'
import { deleteStorageObjects } from '../asset/asset-storage.server'

import type { User } from '@supabase/supabase-js'

export interface CreateUserParams {
	readonly id: string
	readonly email: string
	readonly name?: string
}

export interface UserWithDefaults {
	readonly user: typeof users.$inferSelect
	readonly organization: typeof organizations.$inferSelect
	readonly project: typeof projects.$inferSelect | null
	/** True when the user record was created during this call (first-time sign-in). */
	readonly isNewUser: boolean
}

const db = getDbClient()

type DbClient = typeof db

async function ensureUserExistsDb(
	dbClient: DbClient,
	supabaseUser: User
): Promise<{ user: typeof users.$inferSelect; isNewUser: boolean }> {
	const existingUser = await dbClient
		.select()
		.from(users)
		.where(eq(users.id, supabaseUser.id))
		.limit(1)

	if (existingUser.length > 0) {
		return { user: existingUser[0], isNewUser: false }
	}

	const rawTos = supabaseUser.user_metadata?.tos_accepted_at
	const parsedTosAcceptedAt =
		typeof rawTos === 'string'
			? new Date(rawTos)
			: rawTos instanceof Date
				? rawTos
				: null
	const tosAcceptedAt =
		parsedTosAcceptedAt && !Number.isNaN(parsedTosAcceptedAt.getTime())
			? parsedTosAcceptedAt
			: null

	const normalizedEmail = (supabaseUser.email || '').trim().toLowerCase()

	const inserted = await dbClient
		.insert(users)
		.values({
			id: supabaseUser.id,
			email: normalizedEmail,
			name: supabaseUser.user_metadata?.name || supabaseUser.email || 'User',
			...(tosAcceptedAt !== null && { tosAcceptedAt })
		})
		.onConflictDoNothing()
		.returning()

	// INSERT was a no-op: a unique-constraint conflict fired (id or email).
	if (inserted.length === 0) {
		// Happy path: concurrent request already inserted this exact user (same UUID).
		const [byId] = await dbClient
			.select()
			.from(users)
			.where(eq(users.id, supabaseUser.id))
			.limit(1)

		if (byId) {
			return { user: byId, isNewUser: false }
		}

		// UUID mismatch: the email is already registered under a different UUID.
		// This can happen when Supabase identity linking is disabled and the user
		// has multiple auth identities (e.g. OAuth + email/password) for the same
		// email address, resulting in separate UUIDs. Since Supabase has already
		// authenticated this user with the email, returning the existing record is
		// safe - both UUIDs belong to the same person.
		if (supabaseUser.email) {
			const [byEmail] = await dbClient
				.select()
				.from(users)
				.where(eq(users.email, supabaseUser.email.trim().toLowerCase()))
				.limit(1)

			if (byEmail) {
				console.warn(
					'[ensureUserExistsDb] UUID mismatch - returning existing user by email',
					{
						supabaseUserId: supabaseUser.id,
						existingUserId: byEmail.id
					}
				)
				return { user: byEmail, isNewUser: false }
			}
		}

		// Should be unreachable: INSERT conflicted on email but no row found by email.
		throw new Error(
			`email_conflict: ${supabaseUser.email} is already registered under a different account`
		)
	}

	return { user: inserted[0], isNewUser: true }
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

	if (!organization) {
		throw new Error(
			`[createOrganizationDb] insert returned no rows for userId=${userId}. ` +
				`Check RLS policies or FK constraints on public.organizations.`
		)
	}

	await dbClient.insert(organizationMemberships).values({
		userId,
		organizationId: organization.id,
		role: 'owner'
	})

	// Initialize billing subscription with free-plan defaults
	await dbClient
		.insert(orgSubscriptions)
		.values({
			organizationId: organization.id,
			plan: 'free',
			billingState: 'none'
		})
		.onConflictDoNothing()

	return organization
}

async function getOrCreateDefaultOrganizationDb(
	dbClient: DbClient,
	userId: string
): Promise<typeof organizations.$inferSelect> {
	return dbClient.transaction(async (tx) => {
		const existingOrg = await tx
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

		return await createOrganizationDb(tx, userId, 'My Organization')
	})
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

export async function getOrCreateDefaultOrganization(
	userId: string
): Promise<typeof organizations.$inferSelect> {
	return await db.transaction(async (tx) => {
		return await getOrCreateDefaultOrganizationDb(tx as DbClient, userId)
	})
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
		const { user, isNewUser } = await ensureUserExistsDb(
			tx as DbClient,
			supabaseUser
		)
		const organization = await getOrCreateDefaultOrganizationDb(
			tx as DbClient,
			user.id
		)

		const existingProject = await (tx as DbClient)
			.select()
			.from(projects)
			.where(eq(projects.organizationId, organization.id))
			.limit(1)
			.then((rows) => rows[0] ?? null)

		// Avoid write-on-read side effects for existing users when navigating.
		const project =
			existingProject ??
			(isNewUser
				? await getOrCreateDefaultProjectDb(
						tx as DbClient,
						user.id,
						organization.id
					)
				: null)

		return {
			user,
			organization,
			project,
			isNewUser
		}
	})
}

export async function userExists(userId: string): Promise<boolean> {
	const user = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)

	return user.length > 0
}

export async function getUserByEmail(
	email: string
): Promise<typeof users.$inferSelect | null> {
	const user = await db
		.select()
		.from(users)
		.where(eq(users.email, email.trim().toLowerCase()))
		.limit(1)

	return user[0] ?? null
}

export async function updateUserProfile(
	userId: string,
	updates: {
		name?: string
		role?: string | null
		useCase?: string | null
		companyName?: string | null
		referralSource?: string | null
	}
): Promise<typeof users.$inferSelect> {
	const [updatedUser] = await db
		.update(users)
		.set({
			...(updates.name !== undefined && { name: updates.name }),
			...(updates.role !== undefined && { role: updates.role }),
			...(updates.useCase !== undefined && { useCase: updates.useCase }),
			...(updates.companyName !== undefined && {
				companyName: updates.companyName
			}),
			...(updates.referralSource !== undefined && {
				referralSource: updates.referralSource
			})
		})
		.where(eq(users.id, userId))
		.returning()

	if (!updatedUser) {
		throw new Error('User not found')
	}

	return updatedUser
}

export async function deleteUserAndRelatedData(userId: string): Promise<void> {
	// Two cascades reach assets from a user: `assets.owner_id` directly, and
	// `organizations.owner_id -> projects -> folders -> assets`. Both drop the
	// rows that hold `file_path`, so the paths are read while they still exist.
	const assetPaths = await db
		.selectDistinct({ filePath: assets.filePath })
		.from(assets)
		.leftJoin(folders, eq(folders.id, assets.folderId))
		.leftJoin(projects, eq(projects.id, folders.projectId))
		.leftJoin(organizations, eq(organizations.id, projects.organizationId))
		.where(or(eq(assets.ownerId, userId), eq(organizations.ownerId, userId)))

	const deletedUsers = await db.transaction(async (tx) => {
		// `organization_memberships.invited_by` intentionally uses NO ACTION to
		// preserve invite history, so clear references before deleting the user.
		await tx
			.update(organizationMemberships)
			.set({ invitedBy: null })
			.where(eq(organizationMemberships.invitedBy, userId))

		return tx
			.delete(users)
			.where(eq(users.id, userId))
			.returning({ id: users.id })
	})

	if (deletedUsers.length === 0) {
		throw new Error('User account not found')
	}

	// Outside the transaction and never fatal: the caller goes on to delete the
	// Supabase auth user, and a half-deleted account is worse than a stranded
	// object.
	await deleteStorageObjects(assetPaths.map((row) => row.filePath))
}
