import { count, desc, eq, max, sql, sum } from 'drizzle-orm'

import { planChangeAppliesImmediately } from './billing-situation'
import { getOrgSubscription, getQuotaLimit } from './entitlement-service.server'
import {
	getBillingPeriod,
	isStripeProduct,
	resolvePlanFromPrice
} from './stripe-price-plan'
import { getDbClient } from '../../../db/client'
import {
	assets,
	folders,
	projects,
	sceneAssets,
	sceneFolders,
	scenePublished,
	sceneSettings,
	scenes
} from '../../../db/schema'
import { orgSubscriptions } from '../../../db/schema/billing/subscriptions'
import { getStripeClient } from '../../stripe.server'
import { loadAuthenticatedUser } from '../auth/auth-loader.server'

import type {
	BillingCheckoutOption,
	BillingCheckoutOptions,
	BillingLoaderData,
	BillingSettingsData,
	AssetTypeUsage,
	HeaviestScene,
	LargestAsset,
	OrgUsage,
	ProjectUsage
} from '../dashboard/dashboard-types'

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
		if (!plan) {
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
export async function loadOrgUsage(organizationId: string): Promise<OrgUsage> {
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

/**
 * Where an organization's space and scenes actually are, project by project.
 *
 * The five figures `loadOrgUsage` returns say how much is used. They cannot say
 * what is using it, which is the question anyone opens a usage page with -
 * "340 of 500 MB" is only actionable once you know which project holds the 340.
 *
 * Project, not scene, and deliberately: this is the cut that reconciles with
 * the quota. Storage walks `assets -> folders -> projects`, where an asset has
 * exactly one folder and a folder exactly one project, so every asset is
 * counted once and these figures sum to the organization total.
 *
 * `loadHeaviestScenes` answers the other half through `scene_assets`, and its
 * figures deliberately do not sum, because that join is many-to-many. Both cuts
 * are real; they answer different questions and only one of them can agree with
 * the quota.
 *
 * Three reads rather than one join. Storage walks `assets -> folders ->
 * projects` and scenes group on `scenes.projectId`; joining both at once would
 * multiply every asset row by that project's scene count and inflate the sums.
 * The project list is read separately so a project with nothing in it still
 * appears - an empty project is a real answer to "where is my space going".
 */
export async function loadProjectUsageBreakdown(
	organizationId: string
): Promise<ProjectUsage[]> {
	const db = getDbClient()

	const [projectRows, storageRows, sceneRows] = await Promise.all([
		db
			.select({ id: projects.id, name: projects.name })
			.from(projects)
			.where(eq(projects.organizationId, organizationId)),
		db
			.select({
				projectId: folders.projectId,
				bytes: sum(assets.fileSize)
			})
			.from(assets)
			.innerJoin(folders, eq(folders.id, assets.folderId))
			.innerJoin(projects, eq(projects.id, folders.projectId))
			.where(eq(projects.organizationId, organizationId))
			.groupBy(folders.projectId),
		db
			.select({
				projectId: scenes.projectId,
				sceneCount: count(scenes.id),
				lastChangedAt: max(scenes.updatedAt)
			})
			.from(scenes)
			.innerJoin(projects, eq(projects.id, scenes.projectId))
			.where(eq(projects.organizationId, organizationId))
			.groupBy(scenes.projectId)
	])

	const bytesByProject = new Map(
		storageRows.map((row) => [row.projectId, Number(row.bytes ?? 0)])
	)
	const scenesByProject = new Map(sceneRows.map((row) => [row.projectId, row]))

	return projectRows
		.map((project) => ({
			id: project.id,
			name: project.name,
			storageBytes: bytesByProject.get(project.id) ?? 0,
			sceneCount: scenesByProject.get(project.id)?.sceneCount ?? 0,
			lastChangedAt:
				scenesByProject.get(project.id)?.lastChangedAt?.toISOString() ?? null
		}))
		.sort((a, b) => b.storageBytes - a.storageBytes)
}

/**
 * What kind of file the space is going into.
 *
 * The single most useful cut for anyone whose storage is filling up, because
 * the answer is almost always textures and the fix for textures is different
 * from the fix for geometry. `assets.type` is a real column with five values,
 * so this is a group-by rather than a guess.
 */
export async function loadStorageByAssetType(
	organizationId: string
): Promise<AssetTypeUsage[]> {
	const db = getDbClient()

	const rows = await db
		.select({
			type: assets.type,
			bytes: sum(assets.fileSize),
			fileCount: count(assets.id)
		})
		.from(assets)
		.innerJoin(folders, eq(folders.id, assets.folderId))
		.innerJoin(projects, eq(projects.id, folders.projectId))
		.where(eq(projects.organizationId, organizationId))
		.groupBy(assets.type)

	return rows
		.map((row) => ({
			type: row.type,
			storageBytes: Number(row.bytes ?? 0),
			fileCount: row.fileCount
		}))
		.sort((a, b) => b.storageBytes - a.storageBytes)
}

/**
 * The heaviest individual files, so "something needs optimizing" has a subject.
 *
 * Ten is enough to see a pattern and short enough to read. Whether any of them
 * is *unusually* large is decided by the caller against
 * `storage_bytes_per_scene`, which is the honest reference: a single file
 * taking a quarter of what an entire scene is allowed is worth a look, and that
 * number already exists and already varies by plan. Inventing a threshold, or
 * storing a configurable one in a table with no write path, would both be worse.
 */
export async function loadLargestAssets(
	organizationId: string,
	limit = 10
): Promise<LargestAsset[]> {
	const db = getDbClient()

	const rows = await db
		.select({
			id: assets.id,
			name: assets.name,
			type: assets.type,
			fileSize: assets.fileSize,
			projectId: projects.id,
			projectName: projects.name
		})
		.from(assets)
		.innerJoin(folders, eq(folders.id, assets.folderId))
		.innerJoin(projects, eq(projects.id, folders.projectId))
		.where(eq(projects.organizationId, organizationId))
		.orderBy(desc(assets.fileSize))
		.limit(limit)

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		type: row.type,
		storageBytes: row.fileSize ?? 0,
		projectId: row.projectId,
		projectName: row.projectName
	}))
}

/**
 * The scenes carrying the most weight, which is the unit anyone can act on.
 *
 * A project total says where to look; a scene is what you open in the publisher
 * and optimize. The join runs `assets -> scene_assets -> scene_settings ->
 * scenes`, which is a real many-to-many: `scene_assets` exists so two scenes can
 * share one texture, and `garbageCollectUnreferencedAssets` is what removes an
 * asset once no scene references it any more.
 *
 * That sharing is why these figures do not sum to the organization total, and
 * the page says so rather than leaving it to look like a rounding bug. A shared
 * asset is counted against every scene referencing it, because the question
 * here is "how heavy is this scene to load", not "how much disk would deleting
 * it free". The org total walks `assets -> folders -> projects` instead and
 * counts each asset exactly once, which is the right answer to the quota
 * question and the wrong one to this.
 */
export async function loadHeaviestScenes(
	organizationId: string,
	limit = 8
): Promise<HeaviestScene[]> {
	const db = getDbClient()

	const rows = await db
		.select({
			id: scenes.id,
			name: scenes.name,
			projectId: scenes.projectId,
			projectName: projects.name,
			updatedAt: scenes.updatedAt,
			bytes: sum(assets.fileSize),
			assetCount: count(assets.id)
		})
		.from(sceneAssets)
		.innerJoin(sceneSettings, eq(sceneSettings.id, sceneAssets.sceneSettingsId))
		.innerJoin(scenes, eq(scenes.id, sceneSettings.sceneId))
		.innerJoin(assets, eq(assets.id, sceneAssets.assetId))
		.innerJoin(projects, eq(projects.id, scenes.projectId))
		.where(eq(projects.organizationId, organizationId))
		.groupBy(
			scenes.id,
			scenes.name,
			scenes.projectId,
			projects.name,
			scenes.updatedAt
		)
		.orderBy(desc(sum(assets.fileSize)))
		.limit(limit)

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		projectId: row.projectId,
		projectName: row.projectName,
		storageBytes: Number(row.bytes ?? 0),
		assetCount: row.assetCount,
		updatedAt: row.updatedAt.toISOString()
	}))
}

export async function loadBillingDashboardData(
	request: Request,
	options: { includeCheckoutOptions?: boolean } = {}
): Promise<{
	loaderData: BillingLoaderData
	actorId: string
	/** So a caller can load more for this organization without re-resolving it. */
	organizationId: string
	headers: HeadersInit
}> {
	const { includeCheckoutOptions = true } = options
	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)

	const organizationId = userWithDefaults.organization.id
	const db = getDbClient()
	const [subRow] = await db
		.select({
			currentPeriodEnd: orgSubscriptions.currentPeriodEnd,
			trialEnd: orgSubscriptions.trialEnd,
			stripeCustomerId: orgSubscriptions.stripeCustomerId,
			stripeSubscriptionId: orgSubscriptions.stripeSubscriptionId
		})
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

	const { plan, billingState } = await getOrgSubscription(organizationId)

	/*
	  No usage here. It moved to `/dashboard/usage`, which loads it itself, so
	  the billing page stopped paying for five counting queries it no longer
	  renders.
	*/
	const checkoutOptions = includeCheckoutOptions
		? await getCheckoutOptions()
		: undefined

	const billing: BillingSettingsData = {
		plan,
		billingState,
		currentPeriodEnd: subRow?.currentPeriodEnd?.toISOString() ?? null,
		trialEnd: subRow?.trialEnd?.toISOString() ?? null,
		/*
		  Whether the portal can be opened at all, which is the only thing the
		  page needs to know and exactly what `/api/billing/portal` requires: a
		  Stripe customer, not a plan and not a billing state. The id itself does
		  not leave the server - it is not the page's business and it identifies
		  the customer in Stripe.
		*/
		hasBillingAccount:
			subRow?.stripeCustomerId !== null &&
			subRow?.stripeCustomerId !== undefined,
		changesApplyImmediately: planChangeAppliesImmediately({
			billingState,
			stripeSubscriptionId: subRow?.stripeSubscriptionId ?? null,
			stripeCustomerId: subRow?.stripeCustomerId ?? null
		})
	}

	const loaderData: BillingLoaderData = {
		billing
	}

	if (checkoutOptions) {
		loaderData.checkoutOptions = checkoutOptions
	}

	return {
		loaderData,
		actorId: user.id,
		organizationId,
		headers
	}
}
