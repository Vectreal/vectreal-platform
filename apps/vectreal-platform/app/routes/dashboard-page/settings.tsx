import { eq } from 'drizzle-orm'
import { data } from 'react-router'

import { Route } from './+types/settings'
import { getDbClient } from '../../db/client'
import { orgSubscriptions } from '../../db/schema/billing/subscriptions'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import {
	getOrgSubscription,
	getQuotaLimit
} from '../../lib/domain/billing/entitlement-service.server'
import { getCurrentUsage } from '../../lib/domain/billing/usage-service.server'
import { getUserProjects } from '../../lib/domain/project/project-repository.server'
import { getProjectsScenes } from '../../lib/domain/scene/server/scene-folder-repository.server'

import type { BillingSettingsData, SettingsLoaderData } from '../../lib/domain/dashboard/dashboard-types'


export async function loader({ request }: Route.LoaderArgs) {
	// Authenticate and initialize user
	const { user, userWithDefaults, headers } = await loadAuthenticatedUser(request)

	const organizationId = userWithDefaults.organization.id

	// Fetch subscription record (includes period end and trial end)
	const db = getDbClient()
	const [subRow] = await db
		.select({
			currentPeriodEnd: orgSubscriptions.currentPeriodEnd,
			trialEnd: orgSubscriptions.trialEnd,
			stripeCustomerId: orgSubscriptions.stripeCustomerId
		})
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

	const { plan, billingState } = await getOrgSubscription(organizationId)

	// Fetch quota limits and current usage in parallel
	const [
		sceneQuota,
		optimizationQuota,
		projectsQuota,
		optimizationUsage
	] = await Promise.all([
		getQuotaLimit(organizationId, 'scenes_total'),
		getQuotaLimit(organizationId, 'optimization_runs_per_month'),
		getQuotaLimit(organizationId, 'projects_total'),
		getCurrentUsage(organizationId, 'optimization_runs_per_month')
	])

	// Count current scenes and projects from DB
	const userProjects = await getUserProjects(user.id)
	const projectIds = userProjects.map(({ project }) => project.id)
	const scenesByProject = await getProjectsScenes(projectIds, user.id)
	const totalScenes = Array.from(scenesByProject.values()).flat().length

	const billing: BillingSettingsData = {
		plan,
		billingState,
		currentPeriodEnd: subRow?.currentPeriodEnd?.toISOString() ?? null,
		trialEnd: subRow?.trialEnd?.toISOString() ?? null,
		hasStripeCustomer: !!subRow?.stripeCustomerId,
		usage: {
			scenesTotal: totalScenes,
			sceneLimit: sceneQuota.limit,
			optimizationRuns: optimizationUsage,
			optimizationLimit: optimizationQuota.limit,
			projectsTotal: userProjects.length,
			projectsLimit: projectsQuota.limit
		}
	}

	const loaderData: SettingsLoaderData = {
		user,
		userWithDefaults,
		billing
	}

	return data(loaderData, { headers })
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export { default } from '../../components/dashboard/settings/settings-page'
