import { count, eq, sql } from 'drizzle-orm'
import Stripe from 'stripe'

import { getOrgSubscription, getQuotaLimit } from './entitlement-service.server'
import { getDbClient } from '../../../db/client'
import {
	assets,
	folders,
	projects,
	sceneFolders,
	scenePublished,
	scenes
} from '../../../db/schema'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { getStripeClient } from '../../stripe.server'
import { loadAuthenticatedUser } from '../auth/auth-loader.server'

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
 * Usage and limits for one organization.
 *
 * Every figure is counted for `organizationId` and nothing else. It used to
 * take the caller's projects and scenes as arguments, to save two queries the
 * dashboard index had already run - but those come from `getUserProjects`,
 * which joins `organization_memberships` on the user alone and so spans every
 * organization they belong to. The limits beside them, and all four guards that
 * enforce them, are per-organization.
 *
 * The result was a usage panel where scenes, published scenes and projects were
 * counted across every organization the viewer belonged to while their limits,
 * folders and storage were counted for one: a free user who also sat in a
 * colleague's Business organization read "Projects 21 / 1" in red while project
 * creation worked fine. Two saved queries were not worth a meter that disagrees
 * with the guard beside it.
 */
export async function loadOrgUsage(
	organizationId: string
): Promise<BillingSettingsData['usage']> {
	const db = getDbClient()

	const [
		sceneQuota,
		projectsQuota,
		publishedSceneQuota,
		storageQuota,
		folderQuota
	] = await Promise.all([
		getQuotaLimit(organizationId, 'scenes_total'),
		getQuotaLimit(organizationId, 'projects_total'),
		getQuotaLimit(organizationId, 'scenes_published_concurrent'),
		getQuotaLimit(organizationId, 'storage_bytes_total'),
		getQuotaLimit(organizationId, 'folders_total')
	])

	/*
	  Counted from `scene_folders`, the table `assertFolderQuota` enforces
	  against - not the `folders` table the storage sum below walks. They are two
	  different things with one word between them: `folders` holds assets,
	  `scene_folders` is the dashboard tree the plan limit applies to.

	  This limit was enforced and never displayed, so an organization could be
	  refused a folder it was never told it was near.
	*/
	const [folderRow] = await db
		.select({ total: count() })
		.from(sceneFolders)
		.innerJoin(projects, eq(projects.id, sceneFolders.projectId))
		.where(eq(projects.organizationId, organizationId))
	const foldersTotalUsage = folderRow?.total ?? 0

	/*
	  Counted here rather than taken from the caller, and joined through
	  `projects` the way `createProject` and the `scenes_total` guard count.
	*/
	const [projectRow] = await db
		.select({ total: count() })
		.from(projects)
		.where(eq(projects.organizationId, organizationId))
	const projectsTotalUsage = projectRow?.total ?? 0

	const [sceneRow] = await db
		.select({ total: count() })
		.from(scenes)
		.innerJoin(projects, eq(projects.id, scenes.projectId))
		.where(eq(projects.organizationId, organizationId))
	const scenesTotalUsage = sceneRow?.total ?? 0

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

	/*
	  Published is counted from `scene_published`, not `scenes.status`. The two
	  can disagree, and the quota is enforced against this table.

	  Counted in the database rather than by shipping every scene id into an `IN`
	  list, which is what this did while the caller handed the ids over. That
	  list was as long as the organization's scene count - two thousand on
	  business, unbounded on enterprise - and neither figure needed the ids
	  themselves.
	*/
	const [publishedRow] = await db
		.select({ total: count() })
		.from(scenePublished)
		.innerJoin(scenes, eq(scenes.id, scenePublished.sceneId))
		.innerJoin(projects, eq(projects.id, scenes.projectId))
		.where(eq(projects.organizationId, organizationId))
	const publishedCount = publishedRow?.total ?? 0

	return {
		scenesTotal: scenesTotalUsage,
		sceneLimit: sceneQuota.limit,
		publishedScenes: publishedCount,
		publishedSceneLimit: publishedSceneQuota.limit,
		projectsTotal: projectsTotalUsage,
		projectsLimit: projectsQuota.limit,
		foldersTotal: foldersTotalUsage,
		foldersLimit: folderQuota.limit,
		storageBytesTotal: storageBytesTotalUsage,
		storageLimit: storageQuota.limit
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

	// `loadOrgUsage` fetches what it counts now, so the two queries that used to
	// feed it from the caller's whole membership set are gone with it.
	const [usage, checkoutOptions] = await Promise.all([
		loadOrgUsage(organizationId),
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
