import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { organizationMemberships } from '../../../db/schema/core/organization-memberships'
import { projects } from '../../../db/schema/project/projects'
import {
	getOrgSubscription,
	getQuotaLimit,
	getRecommendedUpgrade
} from '../billing/entitlement-service.server'
import { QuotaExceededError } from '../billing/quota-exceeded-error'
import { checkQuota } from '../billing/usage-service.server'

const db = getDbClient()

type DbClient = typeof db

async function verifyOrganizationAccess(
	dbClient: DbClient,
	organizationId: string,
	userId: string
) {
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

	return membership[0]
}

async function getProjectWithMembership(
	dbClient: DbClient,
	projectId: string,
	userId: string
) {
	const result = await dbClient
		.select({
			project: projects,
			membership: organizationMemberships
		})
		.from(projects)
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.where(
			and(
				eq(projects.id, projectId),
				eq(organizationMemberships.userId, userId)
			)
		)
		.limit(1)

	return result[0]
}

export async function getUserProjects(userId: string): Promise<
	Array<{
		project: typeof projects.$inferSelect
		organizationId: string
	}>
> {
	return await db
		.select({
			project: projects,
			organizationId: projects.organizationId
		})
		.from(projects)
		.innerJoin(
			organizationMemberships,
			eq(organizationMemberships.organizationId, projects.organizationId)
		)
		.where(eq(organizationMemberships.userId, userId))
}

export async function getOrganizationProjects(
	organizationId: string,
	userId: string
): Promise<Array<typeof projects.$inferSelect>> {
	await verifyOrganizationAccess(db, organizationId, userId)

	return await db
		.select()
		.from(projects)
		.where(eq(projects.organizationId, organizationId))
}

export async function getProject(
	projectId: string,
	userId: string
): Promise<typeof projects.$inferSelect | null> {
	const result = await getProjectWithMembership(db, projectId, userId)
	return result?.project || null
}

export async function createProject(
	organizationId: string,
	name: string,
	slug: string,
	userId: string
): Promise<typeof projects.$inferSelect> {
	await verifyOrganizationAccess(db, organizationId, userId)

	const quotaCheck = await checkQuota(organizationId, 'projects_total')
	if (quotaCheck.outcome === 'hard_limit_exceeded') {
		const [{ plan: subscriptionPlan }, { effectivePlan }] = await Promise.all([
			getOrgSubscription(organizationId),
			getQuotaLimit(organizationId, 'projects_total')
		])
		const upgradeTo = getRecommendedUpgrade(effectivePlan)
		const message =
			effectivePlan === 'free'
				? subscriptionPlan === 'free'
					? 'Free plan limit reached: you can have one project. Delete an existing project or upgrade to create another.'
					: 'Project creation is currently limited to free-tier quotas. Delete an existing project or restore full access to create another.'
				: 'Project limit reached for your plan. Upgrade to create more projects.'
		throw new QuotaExceededError({
			limitKey: 'projects_total',
			currentValue: quotaCheck.currentValue,
			limit: quotaCheck.limit,
			plan: effectivePlan,
			upgradeTo,
			message
		})
	}

	const [newProject] = await db
		.insert(projects)
		.values({
			organizationId,
			name,
			slug
		})
		.returning()

	return newProject
}

export async function updateProject(
	projectId: string,
	updates: Partial<
		Pick<typeof projects.$inferSelect, 'name' | 'slug' | 'allowedEmbedDomains'>
	>,
	userId: string
): Promise<typeof projects.$inferSelect> {
	const result = await getProjectWithMembership(db, projectId, userId)
	const { project, membership } = result || {}

	if (!project || !membership) {
		throw new Error('Project not found or access denied')
	}

	if (!['admin', 'owner'].includes(membership.role)) {
		throw new Error('Insufficient permissions to edit this project')
	}

	const [updatedProject] = await db
		.update(projects)
		.set(updates)
		.where(eq(projects.id, projectId))
		.returning()

	return updatedProject
}

export async function deleteProject(
	projectId: string,
	userId: string
): Promise<void> {
	const result = await getProjectWithMembership(db, projectId, userId)
	const { project, membership } = result || {}

	if (!project || !membership) {
		throw new Error('Project not found or access denied')
	}

	if (membership.role !== 'owner') {
		throw new Error('Only organization owners can delete projects')
	}

	await db.delete(projects).where(eq(projects.id, projectId))
}
