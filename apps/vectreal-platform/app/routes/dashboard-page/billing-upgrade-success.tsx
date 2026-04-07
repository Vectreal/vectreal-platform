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
import { Check, CheckCircle2, ExternalLink } from 'lucide-react'
import { useEffect } from 'react'
import { data, Link, redirect, useLoaderData } from 'react-router'

import { PLAN_ENTITLEMENTS } from '../../constants/plan-config'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { syncSubscriptionFromStripe } from '../../lib/domain/billing/stripe-subscription-sync.server'
import { getUserOrganizations } from '../../lib/domain/user/user-repository.server'
import { getStripeClient } from '../../lib/stripe.server'

import type { Route } from './+types/billing-upgrade-success'

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const PLAN_LABELS: Record<string, string> = {
	pro: 'Pro',
	business: 'Business'
}

// Key highlights to show in the "what you just unlocked" list
const FEATURE_LABELS: Partial<
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

function getUnlockedHighlights(planId: string): string[] {
	const plan = planId as 'pro' | 'business'
	if (plan !== 'pro' && plan !== 'business') return []

	const freeEntitlements = PLAN_ENTITLEMENTS.free
	const planEntitlements = PLAN_ENTITLEMENTS[plan]

	return (
		Object.keys(FEATURE_LABELS) as (keyof typeof PLAN_ENTITLEMENTS.free)[]
	)
		.filter((key) => planEntitlements[key] && !freeEntitlements[key])
		.map((key) => FEATURE_LABELS[key]!)
		.slice(0, 5)
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const sessionId = url.searchParams.get('session_id')

	// Authenticate so we can sync the subscription immediately, ensuring the
	// plan is active in the DB before the user navigates to the dashboard.
	const { user, userWithDefaults, headers } =
		await loadAuthenticatedUser(request)
	const organizationId = userWithDefaults.organization.id

	// Enforce owner/admin role — billing writes are restricted to billing admins,
	// consistent with /api/billing/checkout and /api/billing/portal.
	const memberships = await getUserOrganizations(user.id)
	const membership = memberships.find(
		(m) => m.organization.id === organizationId
	)
	if (!membership || !['owner', 'admin'].includes(membership.membership.role)) {
		throw redirect('/dashboard/billing', { headers })
	}

	let planId: string | null = null
	let planLabel: string | null = null
	let billingPeriod: string | null = null
	let fromPlan: string | null = null

	if (sessionId) {
		try {
			const stripe = getStripeClient()
			// Expand the subscription with price/product so plan metadata is
			// available for both display and the immediate DB sync below.
			const session = await stripe.checkout.sessions.retrieve(sessionId, {
				expand: ['subscription.items.data.price.product']
			})

			planId = session.metadata?.plan_id ?? null
			planLabel = planId ? (PLAN_LABELS[planId] ?? null) : null
			billingPeriod = session.metadata?.billing_period ?? null
			fromPlan = session.metadata?.from_plan ?? null

			// Verify the session belongs to this org to prevent session-ID hijacking
			// (an attacker holding another org's session_id must not be able to
			// attach that subscription/customer to their own org record).
			// Sessions created by our checkout always carry organization_id in metadata.
			const sessionOrgId = session.metadata?.organization_id
			const isOwnerSession = sessionOrgId === organizationId

			// Only sync when:
			//   1. The session is confirmed complete/paid.
			//   2. The session belongs to the authenticated org.
			//   3. The session is a subscription checkout with an expanded object.
			if (
				isOwnerSession &&
				session.status === 'complete' &&
				(session.payment_status === 'paid' ||
					session.payment_status === 'no_payment_required') &&
				session.mode === 'subscription' &&
				session.subscription &&
				typeof session.subscription !== 'string'
			) {
				const customerId =
					typeof session.customer === 'string'
						? session.customer
						: (session.customer?.id ?? null)

				if (customerId) {
					await syncSubscriptionFromStripe({
						organizationId,
						stripeCustomerId: customerId,
						subscription: session.subscription
					})
				}
			}
		} catch (error) {
			// Non-critical — Stripe unavailable, continue gracefully
			console.error('Failed to retrieve or sync Stripe checkout session.', error)
		}
	}

	return data({ planId, planLabel, billingPeriod, fromPlan }, { headers })
}

export default function BillingUpgradeSuccessPage() {
	const { planId, planLabel, billingPeriod, fromPlan } =
		useLoaderData<typeof loader>()
	const unlockedFeatures = planId ? getUnlockedHighlights(planId) : []
	const posthog = usePostHog()

	useEffect(() => {
		if (!planId) return
		posthog?.capture('plan_upgrade_completed', {
			from_plan: fromPlan ?? 'free',
			to_plan: planId,
			billing_period: billingPeriod ?? 'monthly'
		})
	}, [planId, fromPlan, billingPeriod, posthog])

	return (
		<div className="mx-auto w-full max-w-xl p-6">
			<Card className="border-primary/20 from-background to-primary/5 bg-gradient-to-b">
				<CardHeader className="space-y-3">
					<div className="flex items-center gap-3">
						<div className="bg-primary/10 rounded-full p-2">
							<CheckCircle2 className="text-primary h-5 w-5" />
						</div>
						{planLabel && (
							<Badge variant="secondary" className="text-sm">
								{planLabel} plan activated
							</Badge>
						)}
					</div>
					<CardTitle className="text-xl">
						{planLabel
							? `You're now on ${planLabel}`
							: "Payment received \u2014 you're all set"}
					</CardTitle>
					<p className="text-muted-foreground text-sm">
						Your workspace will reflect the new plan as soon as billing sync
						finishes. This usually takes a few seconds — a page refresh picks it
						up if anything looks delayed.
					</p>
				</CardHeader>

				{unlockedFeatures.length > 0 && (
					<CardContent className="space-y-3">
						<Separator />
						<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
							What's now available
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

				<CardFooter className="flex flex-col gap-3">
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
