import { usePostHog } from '@posthog/react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { Separator } from '@shared/components/ui/separator'
import { eq } from 'drizzle-orm'
import { ArrowRight, Check, CheckCircle2, ExternalLink } from 'lucide-react'
import { useEffect } from 'react'
import { data, Link, redirect, useLoaderData } from 'react-router'

import { PLAN_ENTITLEMENTS, type Plan } from '../../constants/plan-config'
import { getDbClient } from '../../db/client'
import { orgSubscriptions } from '../../db/schema/billing/subscriptions'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { syncSubscriptionFromStripe } from '../../lib/domain/billing/stripe-subscription-sync.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { getStripeClient } from '../../lib/stripe.server'

import type { Route } from './+types/billing-upgrade-success'

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type PaidPlan = Extract<Plan, 'pro' | 'business'>

const PLAN_LABELS: Record<PaidPlan, string> = {
	pro: 'Pro',
	business: 'Business'
}

const ALL_PLAN_LABELS: Record<Plan, string> = {
	free: 'Free',
	pro: 'Pro',
	business: 'Business',
	enterprise: 'Enterprise'
}

const VALID_PLANS: Plan[] = ['free', 'pro', 'business', 'enterprise']

// Key highlights to show in the "what you just unlocked" section
const FEATURE_HIGHLIGHTS: Partial<
	Record<keyof typeof PLAN_ENTITLEMENTS.free, string>
> = {
	scene_preview_private: 'Private preview links',
	scene_version_history: 'Version history',
	optimization_preset_high: 'High-quality optimization preset',
	optimization_custom_params: 'Custom optimization parameters',
	optimization_priority_queue: 'Priority optimization queue',
	embed_branding_removal: 'Remove Vectreal branding from embeds',
	embed_viewer_customisation: 'Viewer customization & theming',
	embed_analytics: 'Embed analytics and performance data',
	embed_ar_mode: 'AR / WebXR mode for 3D previews',
	org_multi_member: 'Invite team members to your workspace',
	org_roles: 'Role-based access control',
	support_email: 'Email support',
	support_priority: 'Priority support (8 h SLA)'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPaidPlan(planId: string | null): planId is PaidPlan {
	return planId === 'pro' || planId === 'business'
}

function toValidPlan(value: string | null): Plan | null {
	return value && (VALID_PLANS as string[]).includes(value)
		? (value as Plan)
		: null
}

/**
 * Returns the feature highlights unlocked when moving to `plan` from `basePlan`.
 * Compares against `free` by default (new subscriber view).
 */
function getUnlockedHighlights(
	plan: PaidPlan,
	basePlan: Plan = 'free'
): string[] {
	const baseEntitlements = PLAN_ENTITLEMENTS[basePlan]
	const planEntitlements = PLAN_ENTITLEMENTS[plan]

	return (
		Object.keys(FEATURE_HIGHLIGHTS) as (keyof typeof PLAN_ENTITLEMENTS.free)[]
	)
		.filter((key) => planEntitlements[key] && !baseEntitlements[key])
		.map((key) => FEATURE_HIGHLIGHTS[key]!)
		.slice(0, 5)
}

// ---------------------------------------------------------------------------
// Server: checkout session sync
// ---------------------------------------------------------------------------

interface CheckoutData {
	planId: string | null
	billingPeriod: string | null
	fromPlan: string | null
	/** True when the subscription was updated in-place (no Stripe Checkout
	 *  redirect) — the DB is already synced before the user lands here. */
	isDirectUpdate: boolean
}

/**
 * Retrieves the Stripe checkout session, verifies it belongs to the given org,
 * syncs the new subscription to the DB, and cancels any prior subscription that
 * was replaced — preventing double-billing on plan/price switches.
 */
async function syncCompletedCheckout(
	sessionId: string,
	organizationId: string
): Promise<CheckoutData> {
	const stripe = getStripeClient()
	const session = await stripe.checkout.sessions.retrieve(sessionId, {
		expand: ['subscription']
	})

	const base: CheckoutData = {
		planId: session.metadata?.plan_id ?? null,
		billingPeriod: session.metadata?.billing_period ?? null,
		fromPlan: session.metadata?.from_plan ?? null,
		isDirectUpdate: false
	}

	// Security: reject sessions not issued for this org
	if (session.metadata?.organization_id !== organizationId) {
		return base
	}

	const isPaymentSettled =
		session.payment_status === 'paid' ||
		session.payment_status === 'no_payment_required'

	const subscription = session.subscription
	const isEligibleForSync =
		session.status === 'complete' &&
		isPaymentSettled &&
		session.mode === 'subscription' &&
		subscription != null &&
		typeof subscription !== 'string'

	if (!isEligibleForSync || typeof subscription === 'string') return base

	const customerId =
		typeof session.customer === 'string'
			? session.customer
			: (session.customer?.id ?? null)

	if (!customerId) return base

	const db = getDbClient()

	// Capture the existing subscription ID before syncing overwrites it.
	// This is necessary to cancel the old subscription when the user switched
	// plans or billing period — Stripe creates a new subscription rather than
	// updating the existing one, so we must cancel the old one explicitly to
	// avoid double-billing.
	const [existing] = await db
		.select({ stripeSubscriptionId: orgSubscriptions.stripeSubscriptionId })
		.from(orgSubscriptions)
		.where(eq(orgSubscriptions.organizationId, organizationId))
		.limit(1)

	const oldSubscriptionId = existing?.stripeSubscriptionId ?? null

	// Retrieve the full subscription with price+product expanded so that
	// resolvePlanFromSubscription can read metadata (Stripe caps expansion at 4 levels).
	const expandedSubscription = await stripe.subscriptions.retrieve(
		subscription.id,
		{ expand: ['items.data.price.product'] }
	)

	await syncSubscriptionFromStripe({
		organizationId,
		stripeCustomerId: customerId,
		subscription: expandedSubscription
	})

	// Cancel the replaced subscription so the customer is not charged twice.
	// This safety net applies to edge cases where a second subscription was
	// created despite the direct-update path (e.g. stale DB state).
	if (oldSubscriptionId && oldSubscriptionId !== subscription.id) {
		try {
			await stripe.subscriptions.cancel(oldSubscriptionId)
		} catch (err) {
			console.error(
				'[billing] Failed to cancel previous subscription after switch',
				{ oldSubscriptionId, newSubscriptionId: subscription.id, err }
			)
		}
	}

	return base
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const sessionId = url.searchParams.get('session_id')

	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)
	const organizationId = userWithDefaults.organization.id

	// Billing writes are restricted to owners/admins
	const memberships = await getUserOrganizations(user.id)
	const membership = memberships.find(
		(m) => m.organization.id === organizationId
	)
	if (!membership || !['owner', 'admin'].includes(membership.membership.role)) {
		throw redirect('/dashboard/billing', { headers })
	}


	// Direct-update path: the checkout action already updated the subscription
	// in-place and synced the DB. Plan metadata is carried as query params
	// (display-only — actual entitlements are governed by the DB, not these params).
	if (!sessionId) {
		return data(
			{
				planId: url.searchParams.get('plan_id'),
				billingPeriod: url.searchParams.get('billing_period'),
				fromPlan: url.searchParams.get('from_plan'),
				isDirectUpdate: true
			} satisfies CheckoutData,
			{ headers }
		)
	}

	// Stripe Checkout path (new subscribers): sync the completed session.
	let checkoutData: CheckoutData = {
		planId: null,
		billingPeriod: null,
		fromPlan: null,
		isDirectUpdate: false
	}

	try {
		checkoutData = await syncCompletedCheckout(sessionId, organizationId)
	} catch (error) {
		// Non-critical — Stripe unavailable, continue gracefully
		console.error('[billing] Failed to sync checkout session', error)
	}

	return data(checkoutData, { headers })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BillingUpgradeSuccessPage() {
	const { planId, billingPeriod, fromPlan, isDirectUpdate } =
		useLoaderData<typeof loader>()
	const posthog = usePostHog()

	useEffect(() => {
		if (!planId) return
		posthog?.capture('plan_upgrade_completed', {
			from_plan: fromPlan ?? 'free',
			to_plan: planId,
			billing_period: billingPeriod ?? 'monthly'
		})
	}, [planId, fromPlan, billingPeriod, posthog])

	const plan = isPaidPlan(planId) ? planId : null
	const planLabel = plan ? PLAN_LABELS[plan] : null

	const validFromPlan = toValidPlan(fromPlan)
	const isPeriodSwitch = isDirectUpdate && fromPlan === planId
	const isTierUpgrade =
		isDirectUpdate && !isPeriodSwitch && validFromPlan !== null

	// For unlocked features: compare against previous plan on upgrades,
	// against free for new subscribers.
	const basePlan: Plan = isTierUpgrade && validFromPlan ? validFromPlan : 'free'
	const unlockedFeatures =
		plan && !isPeriodSwitch ? getUnlockedHighlights(plan, basePlan) : []

	// Scenario-specific heading and subtitle
	let title: string
	let subtitle: string
	if (isPeriodSwitch && planLabel) {
		const periodLabel = billingPeriod === 'annual' ? 'annual' : 'monthly'
		title = `Switched to ${periodLabel} billing`
		subtitle =
			billingPeriod === 'annual'
				? `Your ${planLabel} subscription is now billed once per year.`
				: `Your ${planLabel} subscription is now billed monthly.`
	} else if (planLabel) {
		title = isDirectUpdate
			? `Upgraded to ${planLabel}`
			: `Welcome to ${planLabel}!`
		subtitle = isDirectUpdate
			? 'All features are available immediately.'
			: 'Your plan is now active and all features are available immediately.'
	} else {
		title = "Payment received — you're all set"
		subtitle =
			'Your subscription is being activated and will be ready momentarily.'
	}

	return (
		<div className="mx-auto w-full max-w-lg p-6">
			<Card className="border-primary/20 from-background to-primary/5 overflow-hidden bg-gradient-to-b">
				<CardHeader className="items-center space-y-4 pb-4 text-center">
					{/* Success icon */}
					<div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
						<CheckCircle2 className="text-primary h-8 w-8" />
					</div>

					<div className="space-y-1.5">
						{planLabel && !isPeriodSwitch && (
							<Badge variant="secondary" className="text-sm">
								{planLabel} plan activated
							</Badge>
						)}
						<CardTitle className="text-2xl">{title}</CardTitle>
						<p className="text-muted-foreground text-sm">{subtitle}</p>
					</div>
				</CardHeader>

				{/* Transition pill — shown for tier upgrades and period switches */}
				{(isTierUpgrade || isPeriodSwitch) && (
					<CardContent className="pt-0 pb-4">
						<div className="bg-muted/60 border-border/40 flex items-center justify-center gap-3 rounded-lg border px-4 py-3">
							<span className="text-muted-foreground text-sm">
								{isTierUpgrade
									? validFromPlan
										? ALL_PLAN_LABELS[validFromPlan]
										: 'Previous plan'
									: billingPeriod === 'annual'
										? 'Monthly'
										: 'Annual'}
							</span>
							<ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
							<span className="text-foreground text-sm font-medium">
								{isTierUpgrade
									? planLabel
									: billingPeriod === 'annual'
										? 'Annual'
										: 'Monthly'}
							</span>
						</div>
					</CardContent>
				)}

				{/* Unlocked features — only for tier changes, not period switches */}
				{unlockedFeatures.length > 0 && (
					<CardContent className="space-y-3 pt-0">
						<Separator />
						<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
							{isTierUpgrade ? 'Newly unlocked' : "What's now available"}
						</p>
						<ul className="space-y-2">
							{unlockedFeatures.map((feature) => (
								<li key={feature} className="flex items-start gap-2 text-sm">
									<Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
									<span>{feature}</span>
								</li>
							))}
						</ul>
						<p className="text-muted-foreground text-xs">
							Manage invoices and payment methods any time in billing settings.
						</p>
					</CardContent>
				)}

				<CardFooter className="flex flex-col gap-3 pt-4">
					<Link to="/dashboard" className="w-full">
						<Button size="lg" className="w-full">
							Go to dashboard
						</Button>
					</Link>
					<Link
						to="/dashboard/billing"
						className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 text-sm transition-colors"
					>
						View billing settings
						<ExternalLink className="h-3.5 w-3.5" />
					</Link>
				</CardFooter>
			</Card>
		</div>
	)
}
