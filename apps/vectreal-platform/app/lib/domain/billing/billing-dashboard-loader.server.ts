import { eq, inArray, sql } from 'drizzle-orm'
import Stripe from 'stripe'

import { getOrgSubscription, getQuotaLimit } from './entitlement-service.server'
import { getCurrentUsage } from './usage-service.server'
import { getDbClient } from '../../../db/client'
import { assets, folders, projects, scenePublished } from '../../../db/schema'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { getStripeClient } from '../../stripe.server'
import { loadAuthenticatedUser } from '../auth/auth-loader.server'
import { getUserProjects } from '../project/project-repository.server'
import { getProjectsScenes } from '../scene/server/scene-folder-repository.server'

import type {
	BillingCheckoutOption,
	BillingCheckoutOptions,
	BillingLoaderData,
	BillingSettingsData
} from '../dashboard/dashboard-types'

const BILLING_PLANS = new Set(['pro', 'business'])

function isStripeProduct(
	product: Stripe.Price['product']
): product is Stripe.Product {
	return (
		typeof product === 'object' &&
		product !== null &&
		!('deleted' in product && product.deleted === true)
	)
}

function getBillingPeriod(price: Stripe.Price): 'monthly' | 'annual' | null {
	if (!price.recurring) {
		return null
	}

	if (
		price.recurring.interval === 'month' &&
		price.recurring.interval_count === 1
	) {
		return 'monthly'
	}

	if (
		price.recurring.interval === 'year' &&
		price.recurring.interval_count === 1
	) {
		return 'annual'
	}

	return null
}

function resolvePlanFromPrice(price: Stripe.Price): 'pro' | 'business' | null {
	const metadataPlan = price.metadata?.vectreal_plan
	if (metadataPlan === 'pro' || metadataPlan === 'business') {
		return metadataPlan
	}

	if (
		isStripeProduct(price.product) &&
		typeof price.product.metadata.vectreal_plan === 'string'
	) {
		const productPlan = price.product.metadata.vectreal_plan
		if (productPlan === 'pro' || productPlan === 'business') {
			return productPlan
		}
	}

	return null
}

export async function getCheckoutOptions(): Promise<BillingCheckoutOptions> {
	const stripe = getStripeClient()
	const options: BillingCheckoutOptions = {
		pro: { monthly: null, annual: null },
		business: { monthly: null, annual: null }
	}

	const prices = await stripe.prices.list({
		active: true,
		type: 'recurring',
		expand: ['data.product'],
		limit: 100
	})

	for (const price of prices.data) {
		const plan = resolvePlanFromPrice(price)
		if (!plan || !BILLING_PLANS.has(plan)) {
			continue
		}

		const billingPeriod = getBillingPeriod(price)
		if (!billingPeriod) {
			continue
		}

		if (!price.recurring || price.unit_amount === null) {
			continue
		}

		const checkoutOption: BillingCheckoutOption = {
			priceId: price.id,
			amountCents: price.unit_amount,
			currency: price.currency,
			interval: billingPeriod === 'monthly' ? 'month' : 'year',
			intervalCount: price.recurring.interval_count,
			productName: isStripeProduct(price.product) ? price.product.name : null
		}

		if (!options[plan][billingPeriod]) {
			options[plan][billingPeriod] = checkoutOption
		}
	}

	return options
}

/**
 * Usage and limits for one organization, given its projects and scenes.
 *
 * Takes them as arguments rather than fetching them so callers that already
 * have them - the dashboard index loads every scene row to compute its own
 * stats - do not pay for the same two queries twice.
 */
export async function loadOrgUsage(
	organizationId: string,
	userProjects: Array<unknown>,
	allScenes: Array<{ id: string }>
): Promise<BillingSettingsData['usage']> {
	const db = getDbClient()

	const [
		sceneQuota,
		projectsQuota,
		publishedSceneQuota,
		apiRequestsMonthQuota,
		storageQuota,
		embedBandwidthQuota,
		previewLoadsQuota,
		apiRequestsMonthUsage,
		embedBandwidthUsage,
		previewLoadsUsage
	] = await Promise.all([
		getQuotaLimit(organizationId, 'scenes_total'),
		getQuotaLimit(organizationId, 'projects_total'),
		getQuotaLimit(organizationId, 'scenes_published_concurrent'),
		getQuotaLimit(organizationId, 'api_requests_per_month'),
		getQuotaLimit(organizationId, 'storage_bytes_total'),
		getQuotaLimit(organizationId, 'embed_bandwidth_gb_per_month'),
		getQuotaLimit(organizationId, 'preview_loads_per_month'),
		getCurrentUsage(organizationId, 'api_requests_per_month'),
		getCurrentUsage(organizationId, 'embed_bandwidth_gb_per_month'),
		getCurrentUsage(organizationId, 'preview_loads_per_month')
	])

	const allSceneIds = allScenes.map((scene) => scene.id)

	/*
	  Storage is measured, not counted.

	  It used to come from `getCurrentUsage(org, 'storage_bytes_total')`, which
	  reads a usage counter - and nothing in the codebase ever incremented that
	  counter. The key was read in two places and written in none, so the figure
	  was structurally 0 for every organization on every plan, on both the
	  billing page and anywhere else it was shown. Summing `assets.file_size`
	  reports what is actually stored, the same way published scenes are counted
	  from `scene_published` rather than from a counter.

	  Measured by ownership rather than through `scene_assets`, which got two
	  things wrong. It could not see an asset that no scene links - a published
	  GLB lives in `scene_published`, and an upload whose commit failed lives in
	  neither - so real bytes in the bucket were reported as zero. And because
	  the sum ran over join rows, an asset shared by several scenes (uploads are
	  content-addressed and deduplicated per project, so sharing is normal) was
	  counted once per scene.

	  Walking `assets -> folders -> projects` fixes both at once, and needs no
	  `distinct` to do it: an asset has exactly one folder and a folder exactly
	  one project, so every row appears once by construction. The duplicate was
	  never a property of the asset, only of the join that used to be here.
	*/
	const [storageRow] = await db
		.select({ total: sql<null | string>`sum(${assets.fileSize})` })
		.from(assets)
		.innerJoin(folders, eq(folders.id, assets.folderId))
		.innerJoin(projects, eq(projects.id, folders.projectId))
		.where(eq(projects.organizationId, organizationId))
	const storageBytesTotalUsage = Number(storageRow?.total ?? 0)

	// Published is counted from `scene_published`, not `scenes.status`. The two
	// can disagree, and the quota is enforced against this table.
	let publishedCount = 0
	if (allSceneIds.length > 0) {
		const publishedRows = await db
			.select({ sceneId: scenePublished.sceneId })
			.from(scenePublished)
			.where(inArray(scenePublished.sceneId, allSceneIds))
		publishedCount = publishedRows.length
	}

	return {
		scenesTotal: allScenes.length,
		sceneLimit: sceneQuota.limit,
		publishedScenes: publishedCount,
		publishedSceneLimit: publishedSceneQuota.limit,
		projectsTotal: userProjects.length,
		projectsLimit: projectsQuota.limit,
		apiRequestsMonth: apiRequestsMonthUsage,
		apiRequestsMonthLimit: apiRequestsMonthQuota.limit,
		storageBytesTotal: storageBytesTotalUsage,
		storageLimit: storageQuota.limit,
		embedBandwidthMonth: embedBandwidthUsage,
		embedBandwidthLimit: embedBandwidthQuota.limit,
		previewLoadsMonth: previewLoadsUsage,
		previewLoadsMonthLimit: previewLoadsQuota.limit
	}
}

export async function loadBillingDashboardData(
	request: Request,
	options: { includeCheckoutOptions?: boolean } = {}
): Promise<{ loaderData: BillingLoaderData; headers: HeadersInit }> {
	const { includeCheckoutOptions = true } = options
	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)

	const organizationId = userWithDefaults.organization.id
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

	const userProjects = await getUserProjects(user.id)
	const projectIds = userProjects.map(({ project }) => project.id)
	const scenesByProject = await getProjectsScenes(projectIds, user.id)
	const allScenes = Array.from(scenesByProject.values()).flat()

	const [usage, checkoutOptions] = await Promise.all([
		loadOrgUsage(organizationId, userProjects, allScenes),
		includeCheckoutOptions ? getCheckoutOptions() : Promise.resolve(undefined)
	])

	const billing: BillingSettingsData = {
		plan,
		billingState,
		currentPeriodEnd: subRow?.currentPeriodEnd?.toISOString() ?? null,
		trialEnd: subRow?.trialEnd?.toISOString() ?? null,
		hasStripeCustomer: !!subRow?.stripeCustomerId,
		usage
	}

	const loaderData: BillingLoaderData = {
		user,
		userWithDefaults,
		billing
	}

	if (checkoutOptions) {
		loaderData.checkoutOptions = checkoutOptions
	}

	return {
		loaderData,
		headers
	}
}
