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
import {
	ArrowRight,
	Check,
	CheckCircle2,
	ExternalLink,
	Minus
} from 'lucide-react'
import { useEffect } from 'react'
import { data, Link, redirect, useLoaderData } from 'react-router'

import { getDbClient } from '../../db/client'
import { orgSubscriptions } from '../../db/schema/billing/subscriptions'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { describePlanChange } from '../../lib/domain/billing/plan-change-outcome'
import { syncSubscriptionFromStripe } from '../../lib/domain/billing/stripe-subscription-sync.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'
import { getStripeClient } from '../../lib/stripe.server'

import type { Route } from './+types/billing-upgrade-success'

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

// ---------------------------------------------------------------------------
// Server: checkout session sync
// ---------------------------------------------------------------------------

interface CheckoutData {
	planId: string | null
	billingPeriod: string | null
	fromPlan: string | null
	/** True when the subscription was updated in-place (no Stripe Checkout
	 *  redirect) - the DB is already synced before the user lands here. */
	isDirectUpdate: boolean
}

/**
 * Retrieves the Stripe checkout session, verifies it belongs to the given org,
 * syncs the new subscription to the DB, and cancels any prior subscription that
 * was replaced - preventing double-billing on plan/price switches.
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
	// plans or billing period - Stripe creates a new subscription rather than
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
			/*
			  The customer now holds two live Stripe subscriptions and is billed
			  for both. No request in scope here - this runs from a helper - so
			  the report carries the ids instead.
			*/
			reportServerError(err, {
				properties: {
					oldSubscriptionId,
					newSubscriptionId: subscription.id
				}
			})
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
	// (display-only - actual entitlements are governed by the DB, not these params).
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
		// Non-critical for the page, which still renders: the subscription is
		// reconciled by the webhook. Reported because "the webhook will fix it"
		// is a claim nobody is checking.
		reportServerError(error, { request })
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

	/*
	  Which way this change points, and what to say about it, are decided in one
	  place. This page used to take the word "upgrade" from `isDirectUpdate`,
	  which says which code path Stripe took and nothing about direction, so a
	  move down the ladder is announced as a gain and offered
	  "All features are available immediately" while three of them leave.
	*/
	const outcome = describePlanChange({
		planId,
		billingPeriod,
		fromPlan,
		isDirectUpdate
	})

	useEffect(() => {
		if (!planId) return
		posthog?.capture('plan_upgrade_completed', {
			from_plan: fromPlan ?? 'free',
			to_plan: planId,
			billing_period: billingPeriod ?? 'monthly'
		})
	}, [planId, fromPlan, billingPeriod, posthog])

	const { planLabel, title, subtitle, gained, lost, reducedLimits } = outcome
	const isPeriodSwitch = outcome.kind === 'period_switch'
	// A direct move between two tiers: the only case with a prior plan to name.
	const isTierChange = outcome.fromPlan !== null

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

				{/* Transition pill - shown for tier upgrades and period switches */}
				{(isTierChange || isPeriodSwitch) && (
					<CardContent className="pt-0 pb-4">
						<div className="bg-muted/60 border-border/40 flex items-center justify-center gap-3 rounded-lg border px-4 py-3">
							<span className="text-muted-foreground text-sm">
								{isTierChange
									? (outcome.fromPlanLabel ?? 'Previous plan')
									: billingPeriod === 'annual'
										? 'Monthly'
										: 'Annual'}
							</span>
							<ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
							<span className="text-foreground text-sm font-medium">
								{isTierChange
									? planLabel
									: billingPeriod === 'annual'
										? 'Annual'
										: 'Monthly'}
							</span>
						</div>
					</CardContent>
				)}

				{/* Unlocked features - only for tier changes, not period switches */}
				{gained.length > 0 && (
					<CardContent className="space-y-3 pt-0">
						<Separator />
						<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
							{isTierChange ? 'Newly unlocked' : "What's now available"}
						</p>
						<ul className="space-y-2">
							{gained.map((feature) => (
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

				{/*
				  What the change takes away. Nothing renders this today, so a
				  reader moving down gets a transition pill and no word about the
				  entitlements and quotas leaving with it.
				*/}
				{(lost.length > 0 || reducedLimits.length > 0) && (
					<CardContent className="space-y-3 pt-0">
						<Separator />
						<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
							No longer included
						</p>
						<ul className="space-y-2">
							{lost.map((feature) => (
								<li key={feature} className="flex items-start gap-2 text-sm">
									<Minus className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
									<span>{feature}</span>
								</li>
							))}
							{reducedLimits.map((limit) => (
								<li key={limit.key} className="flex items-start gap-2 text-sm">
									<Minus className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
									<span>
										{limit.label}{' '}
										<span className="text-muted-foreground">
											{limit.from} to {limit.to}
										</span>
									</span>
								</li>
							))}
						</ul>
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
