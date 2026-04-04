import { and, asc, eq, sql } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { organizations } from '../../../db/schema/core/organizations'
import { users } from '../../../db/schema/core/users'
import { projects } from '../../../db/schema/project/projects'

const db = getDbClient()

type MembershipRole = (typeof organizationMemberships.$inferSelect)['role']

export interface OrganizationMember {
	membership: typeof organizationMemberships.$inferSelect
	user: Pick<typeof users.$inferSelect, 'id' | 'email' | 'name'>
}

export interface OrganizationDetail {
	organization: typeof organizations.$inferSelect
	membership: typeof organizationMemberships.$inferSelect
}

async function getOrganizationDetailRow(
	organizationId: string,
	userId: string
): Promise<OrganizationDetail | null> {
	const rows = await db
		.select({
			organization: organizations,
			membership: organizationMemberships
		})
		.from(organizations)
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, organizations.id)
		)
		.where(
			and(
				eq(organizations.id, organizationId),
				eq(organizationMemberships.userId, userId)
			)
		)
		.limit(1)

	const row = rows[0]
	if (!row) {
		return null
	}

	return {
		organization: row.organization,
		membership: row.membership
	}
}

async function getMembershipCountByRole(
	organizationId: string,
	role: MembershipRole
): Promise<number> {
	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.role, role)
			)
		)

	return rows[0]?.count ?? 0
}

function ensureAdminOrOwner(
	membership: typeof organizationMemberships.$inferSelect
) {
	if (!['admin', 'owner'].includes(membership.role)) {
		throw new Error('Insufficient permissions')
	}
}

export async function getOrganizationDetailForUser(
	organizationId: string,
	userId: string
): Promise<OrganizationDetail> {
	const detail = await getOrganizationDetailRow(organizationId, userId)
	if (!detail) {
		throw new Error('Organization not found or access denied')
	}

	return detail
}

export async function getOrganizationMembers(
	organizationId: string,
	userId: string
): Promise<OrganizationMember[]> {
	await getOrganizationDetailForUser(organizationId, userId)

	return await db
		.select({
			membership: organizationMemberships,
			user: {
				id: users.id,
				email: users.email,
				name: users.name
			}
		})
		.from(organizationMemberships)
		.innerJoin(users, eq(users.id, organizationMemberships.userId))
		.where(eq(organizationMemberships.organizationId, organizationId))
		.orderBy(
			sql`case ${organizationMemberships.role} when 'owner' then 1 when 'admin' then 2 else 3 end`,
			asc(organizationMemberships.joinedAt)
		)
}

export async function getOrganizationProjectsTotal(
	organizationId: string,
	userId: string
): Promise<number> {
	await getOrganizationDetailForUser(organizationId, userId)

	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(projects)
		.where(eq(projects.organizationId, organizationId))

	return rows[0]?.count ?? 0
}

export async function updateOrganizationName(
	organizationId: string,
	userId: string,
	name: string
): Promise<typeof organizations.$inferSelect> {
	const detail = await getOrganizationDetailForUser(organizationId, userId)
	ensureAdminOrOwner(detail.membership)

	const [updatedOrganization] = await db
		.update(organizations)
		.set({
			name,
			updatedAt: new Date()
		})
		.where(eq(organizations.id, organizationId))
		.returning()

	if (!updatedOrganization) {
		throw new Error('Failed to update organization')
	}

	return updatedOrganization
}

export async function inviteOrganizationMember(
	organizationId: string,
	actorUserId: string,
	targetUserId: string,
	role: Exclude<MembershipRole, 'owner'>
): Promise<typeof organizationMemberships.$inferSelect> {
	const detail = await getOrganizationDetailForUser(organizationId, actorUserId)
	ensureAdminOrOwner(detail.membership)

	const existing = await db
		.select()
		.from(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.userId, targetUserId)
			)
		)
		.limit(1)

	if (existing.length > 0) {
		throw new Error('User is already a member of this organization')
	}

	const [membership] = await db
		.insert(organizationMemberships)
		.values({
			organizationId,
			userId: targetUserId,
			role,
			invitedAt: new Date(),
			invitedBy: actorUserId
		})
		.returning()

	return membership
}

export async function updateOrganizationMemberRole(
	organizationId: string,
	actorUserId: string,
	targetUserId: string,
	nextRole: MembershipRole
): Promise<typeof organizationMemberships.$inferSelect> {
	const detail = await getOrganizationDetailForUser(organizationId, actorUserId)
	ensureAdminOrOwner(detail.membership)

	const [targetMembership] = await db
		.select()
		.from(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.userId, targetUserId)
			)
		)
		.limit(1)

	if (!targetMembership) {
		throw new Error('Member not found')
	}

	if (detail.membership.role !== 'owner') {
		if (nextRole === 'owner' || targetMembership.role !== 'member') {
			throw new Error(
				'Only organization owners can assign or edit privileged roles'
			)
		}
	}

	const [updatedMembership] = await db
		.update(organizationMemberships)
		.set({ role: nextRole })
		.where(eq(organizationMemberships.id, targetMembership.id))
		.returning()

	if (!updatedMembership) {
		throw new Error('Failed to update member role')
	}

	return updatedMembership
}

export async function removeOrganizationMember(
	organizationId: string,
	actorUserId: string,
	targetUserId: string
): Promise<void> {
	const detail = await getOrganizationDetailForUser(organizationId, actorUserId)
	ensureAdminOrOwner(detail.membership)

	const [targetMembership] = await db
		.select()
		.from(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.userId, targetUserId)
			)
		)
		.limit(1)

	if (!targetMembership) {
		throw new Error('Member not found')
	}

	if (
		detail.membership.role !== 'owner' &&
		targetMembership.role !== 'member'
	) {
		throw new Error('Only organization owners can remove admins or owners')
	}

	if (targetMembership.role === 'owner') {
		const ownerCount = await getMembershipCountByRole(organizationId, 'owner')
		if (ownerCount <= 1) {
			throw new Error('Cannot remove the last organization owner')
		}
	}

	await db
		.delete(organizationMemberships)
		.where(eq(organizationMemberships.id, targetMembership.id))
}

export async function leaveOrganization(
	organizationId: string,
	userId: string
): Promise<void> {
	const detail = await getOrganizationDetailForUser(organizationId, userId)

	if (detail.membership.role === 'owner') {
		const ownerCount = await getMembershipCountByRole(organizationId, 'owner')
		if (ownerCount <= 1) {
			throw new Error(
				'You are the last owner. Add another owner before leaving this organization.'
			)
		}
	}

	await db
		.delete(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.organizationId, organizationId),
				eq(organizationMemberships.userId, userId)
			)
		)
}

export async function deleteOrganization(
	organizationId: string,
	userId: string
): Promise<void> {
	const detail = await getOrganizationDetailForUser(organizationId, userId)
	if (detail.membership.role !== 'owner') {
		throw new Error('Only organization owners can delete organizations')
	}

	const projectsTotal = await getOrganizationProjectsTotal(
		organizationId,
		userId
	)
	if (projectsTotal > 0) {
		throw new Error(
			'Delete all projects in this organization before deleting it'
		)
	}

	await db.delete(organizations).where(eq(organizations.id, organizationId))
}
