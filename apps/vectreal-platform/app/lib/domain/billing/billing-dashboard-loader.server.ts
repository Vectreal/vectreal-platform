import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

import { getOrgSubscription, getQuotaLimit } from './entitlement-service.server'
import { getCurrentUsage } from './usage-service.server'
import { getDbClient } from '../../../db/client'
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

async function getCheckoutOptions(): Promise<BillingCheckoutOptions> {
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

export async function loadBillingDashboardData(
	request: Request
): Promise<{ loaderData: BillingLoaderData; headers: HeadersInit }> {
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

	const [
		sceneQuota,
		optimizationQuota,
		projectsQuota,
		optimizationUsage,
		checkoutOptions
	] = await Promise.all([
		getQuotaLimit(organizationId, 'scenes_total'),
		getQuotaLimit(organizationId, 'optimization_runs_per_month'),
		getQuotaLimit(organizationId, 'projects_total'),
		getCurrentUsage(organizationId, 'optimization_runs_per_month'),
		getCheckoutOptions()
	])

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

	return {
		loaderData: {
			user,
			userWithDefaults,
			billing,
			checkoutOptions
		},
		headers
	}
}
