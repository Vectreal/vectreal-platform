import type { User } from '@supabase/supabase-js'

import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../db/client'
import { organizationMemberships } from '../../db/schema/core/organization-memberships'
import { organizations } from '../../db/schema/core/organizations'
import { users } from '../../db/schema/core/users'
import { projects } from '../../db/schema/project/projects'

/**
 * Parameters for creating a new user.
 */
export interface CreateUserParams {
	readonly id: string
	readonly email: string
	readonly name?: string
}

/**
 * User with default organization and project.
 */
export interface UserWithDefaults {
	readonly user: typeof users.$inferSelect
	readonly organization: typeof organizations.$inferSelect
	readonly project: typeof projects.$inferSelect
}

/**
 * Service for user-related database operations.
 * Handles user creation, organization and project management.
 */
export class UserService {
	private readonly db = getDbClient()

	/**
	 * Ensures user exists in local database, creates if not found.
	 * @param supabaseUser - User from Supabase authentication
	 * @returns Local database user record
	 */
	async ensureUserExists(
		supabaseUser: User
	): Promise<typeof users.$inferSelect> {
		// Check if user already exists
		const existingUser = await this.db
			.select()
			.from(users)
			.where(eq(users.id, supabaseUser.id))
			.limit(1)

		if (existingUser.length > 0) {
			return existingUser[0]
		}

		// Create new user
		const [newUser] = await this.db
			.insert(users)
			.values({
				id: supabaseUser.id,
				email: supabaseUser.email || '',
				name: supabaseUser.user_metadata?.name || supabaseUser.email || 'User'
			})
			.returning()

		return newUser
	}

	/**
	 * Creates a new organization and adds the user as owner.
	 * @param userId - The user ID who will own the organization
	 * @param name - The organization name
	 * @returns Created organization record
	 */
	async createOrganization(
		userId: string,
		name: string
	): Promise<typeof organizations.$inferSelect> {
		return await this.db.transaction(async (tx) => {
			// Create the organization
			const [organization] = await tx
				.insert(organizations)
				.values({
					name,
					ownerId: userId
				})
				.returning()

			// Add the creator as owner member
			await tx.insert(organizationMemberships).values({
				userId,
				organizationId: organization.id,
				role: 'owner'
			})

			return organization
		})
	}

	/**
	 * Gets or creates default organization for a user.
	 * Creates user-specific organizations to ensure data isolation.
	 * @param userId - The user ID
	 * @returns Default organization record
	 */
	async getOrCreateDefaultOrganization(
		userId: string
	): Promise<typeof organizations.$inferSelect> {
		// Check if user already has a default organization
		const existingOrg = await this.db
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

		// Create default organization for this user
		return await this.createOrganization(userId, 'My Organization')
	}

	/**
	 * Gets all organizations a user is a member of.
	 * @param userId - The user ID
	 * @returns Array of organizations with membership info
	 */
	async getUserOrganizations(userId: string): Promise<
		Array<{
			organization: typeof organizations.$inferSelect
			membership: typeof organizationMemberships.$inferSelect
		}>
	> {
		return await this.db
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

	/**
	 * Checks if a user is a member of an organization.
	 * @param userId - The user ID
	 * @param organizationId - The organization ID
	 * @returns Membership record if user is a member, null otherwise
	 */
	async getUserOrganizationMembership(
		userId: string,
		organizationId: string
	): Promise<typeof organizationMemberships.$inferSelect | null> {
		const membership = await this.db
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

	/**
	 * Adds a user to an organization.
	 * @param userId - The user ID to add
	 * @param organizationId - The organization ID
	 * @param role - The role to assign (default: 'member')
	 * @param invitedBy - The user ID who is inviting (optional)
	 * @returns Created membership record
	 */
	async addUserToOrganization(
		userId: string,
		organizationId: string,
		role: 'owner' | 'admin' | 'member' = 'member',
		invitedBy?: string
	): Promise<typeof organizationMemberships.$inferSelect> {
		// Check if user is already a member
		const existingMembership = await this.getUserOrganizationMembership(
			userId,
			organizationId
		)

		if (existingMembership) {
			throw new Error('User is already a member of this organization')
		}

		// Add user to organization
		const [membership] = await this.db
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

	/**
	 * Gets or creates default project for a user in a specific organization.
	 * @param userId - The user ID
	 * @param organizationId - Optional organization ID
	 * @returns Default project record
	 */
	async getOrCreateDefaultProject(
		userId: string,
		organizationId?: string
	): Promise<typeof projects.$inferSelect> {
		// Get organization if not provided
		let orgId = organizationId
		if (!orgId) {
			const org = await this.getOrCreateDefaultOrganization(userId)
			orgId = org.id
		}

		// Verify user has access to this organization
		const membership = await this.getUserOrganizationMembership(userId, orgId)
		if (!membership) {
			throw new Error(
				'User does not have permission to access this organization'
			)
		}

		// Check if organization already has a project
		let project = await this.db
			.select()
			.from(projects)
			.where(eq(projects.organizationId, orgId))
			.limit(1)
			.then((rows) => rows[0])

		if (!project) {
			// Create default project
			const [newProject] = await this.db
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

	/**
	 * Initializes a new user with default organization and project.
	 * @param supabaseUser - User from Supabase authentication
	 * @returns User with defaults
	 */
	async initializeUserDefaults(supabaseUser: User): Promise<UserWithDefaults> {
		return await this.db.transaction(async (tx) => {
			// Ensure user exists in local database
			const user = await this.ensureUserExists(supabaseUser)

			// Get or create default organization
			const organization = await this.getOrCreateDefaultOrganization(user.id)

			// Get or create default project
			const project = await this.getOrCreateDefaultProject(
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

	/**
	 * Gets user with their default project ID (for scene creation).
	 * @param userId - The user ID
	 * @returns User with project ID or null if not found
	 */
	async getUserWithDefaultProject(
		userId: string
	): Promise<{ user: typeof users.$inferSelect; projectId: string } | null> {
		const user = await this.db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
			.then((rows) => rows[0])

		if (!user) return null

		const project = await this.getOrCreateDefaultProject(userId)

		return {
			user,
			projectId: project.id
		}
	}

	/**
	 * Checks if user exists in local database.
	 * @param userId - The user ID to check
	 * @returns Whether the user exists
	 */
	async userExists(userId: string): Promise<boolean> {
		const user = await this.db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)

		return user.length > 0
	}
}

export const userService = new UserService()
