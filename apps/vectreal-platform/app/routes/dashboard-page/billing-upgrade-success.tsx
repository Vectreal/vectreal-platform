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
import { data, Link, useLoaderData } from 'react-router'

import { PLAN_ENTITLEMENTS } from '../../constants/plan-config'
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

	let planId: string | null = null
	let planLabel: string | null = null

	if (sessionId) {
		try {
			const stripe = getStripeClient()
			const session = await stripe.checkout.sessions.retrieve(sessionId)
			planId = session.metadata?.plan_id ?? null
			planLabel = planId ? (PLAN_LABELS[planId] ?? null) : null
		} catch (error) {
			// Non-critical — Stripe unavailable, continue gracefully
			console.error('Failed to retrieve Stripe checkout session.', error)
		}
	}

	return data({ planId, planLabel })
}

export default function BillingUpgradeSuccessPage() {
	const { planId, planLabel } = useLoaderData<typeof loader>()
	const unlockedFeatures = planId ? getUnlockedHighlights(planId) : []

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
