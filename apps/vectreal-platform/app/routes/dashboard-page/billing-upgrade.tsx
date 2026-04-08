import { useFeatureFlagEnabled, usePostHog } from '@posthog/react'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent } from '@shared/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import {
	AlertTriangle,
	ArrowRight,
	ChevronLeft,
	Loader2,
	Lock
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
	data,
	Link,
	useFetcher,
	useLoaderData,
	useSearchParams
} from 'react-router'

import { Route } from './+types/billing-upgrade'
import {
	FeatureCompareGrid,
	PricingCardsSection
} from '../../components/dashboard'
import { PLAN_ENTITLEMENTS, type Plan } from '../../constants/plan-config'
import { loadBillingDashboardData } from '../../lib/domain/billing/billing-dashboard-loader.server'

import type { BillingCheckoutPeriods } from '../../lib/domain/dashboard/dashboard-types'
import type { PostHogContext } from '../../lib/posthog/posthog-middleware'

const PLAN_LABELS = {
	free: 'Free',
	pro: 'Pro',
	business: 'Business',
	enterprise: 'Enterprise'
} as const

type BillingPeriod = 'monthly' | 'annual'

function formatCurrency(amountCents: number, currency: string) {
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: currency.toUpperCase(),
		maximumFractionDigits: 0
	}).format(amountCents / 100)
}

function getUnlockedFeatures(
	currentPlan: Plan,
	selectedPlan: 'pro' | 'business'
) {
	if (currentPlan === selectedPlan) return []

	const currentEntitlements = PLAN_ENTITLEMENTS[currentPlan]
	const selectedEntitlements = PLAN_ENTITLEMENTS[selectedPlan]
	const labels: Record<keyof typeof PLAN_ENTITLEMENTS.free, string> = {
		scene_upload: 'Scene upload',
		scene_optimize: 'Optimization pipeline',
		scene_publish: 'Publish to CDN',
		scene_embed: 'Embed snippet',
		scene_preview_private: 'Private preview links',
		scene_version_history: 'Version history',
		optimization_preset_low: 'Low / medium presets',
		optimization_preset_medium: 'Low / medium presets',
		optimization_preset_high: 'High-quality optimization preset',
		optimization_custom_params: 'Custom optimization parameters',
		optimization_priority_queue: 'Priority optimization queue',
		embed_domain_allowlist: 'Embed domain allowlist',
		embed_branding_removal: 'Branding removal',
		embed_viewer_customisation: 'Viewer customization',
		embed_analytics: 'Embed analytics',
		embed_ar_mode: 'AR / WebXR mode',
		org_multi_member: 'Multi-member workspace',
		org_roles: 'Role-based access',
		org_api_keys: 'Organization API keys',
		org_sso: 'SSO',
		org_audit_log: 'Audit log export',
		data_export: 'Data export',
		data_residency_eu: 'EU data residency',
		data_residency_custom: 'Custom data residency',
		support_community: 'Community support',
		support_email: 'Email support',
		support_priority: 'Priority support',
		support_dedicated: 'Dedicated support channel'
	}

	const seen = new Set<string>()
	const unlocked = Object.keys(selectedEntitlements)
		.filter((key) => {
			const typedKey = key as keyof typeof selectedEntitlements
			return selectedEntitlements[typedKey] && !currentEntitlements[typedKey]
		})
		.map((key) => labels[key as keyof typeof labels])
		.filter((label) => label && !seen.has(label) && !!seen.add(label))

	return unlocked.slice(0, 6)
}

function computeAnnualSavings(pricing: BillingCheckoutPeriods) {
	if (!pricing.monthly || !pricing.annual) return null
	const monthlyYearlyCost = pricing.monthly.amountCents * 12
	const annualCost = pricing.annual.amountCents
	if (monthlyYearlyCost <= annualCost) return null
	return {
		yearlySavingsCents: monthlyYearlyCost - annualCost,
		monthlyEquivalentCents: Math.round(annualCost / 12)
	}
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { loaderData, headers } = await loadBillingDashboardData(request)
	const posthog = (context as PostHogContext).posthog
	const checkoutEnabled = posthog
		? ((await posthog.isFeatureEnabled(
				'billing-checkout',
				loaderData.user.id
			)) ?? false)
		: true // default to enabled when PostHog is not configured (e.g. local dev)
	return data({ ...loaderData, checkoutEnabled }, { headers })
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function BillingUpgradePage() {
	const {
		checkoutOptions,
		billing,
		checkoutEnabled: serverCheckoutEnabled
	} = useLoaderData<typeof loader>()
	const [searchParams] = useSearchParams()
	const checkoutFetcher = useFetcher()
	const posthog = usePostHog()

	// Client-side flag evaluation — undefined while PostHog is loading; fall back
	// to the server-resolved value so the button state is correct on first render.
	const clientFlagEnabled = useFeatureFlagEnabled('billing-checkout')
	const checkoutEnabled =
		clientFlagEnabled !== undefined ? clientFlagEnabled : serverCheckoutEnabled

	const requestedPlan = searchParams.get('plan')
	const initialPlan = requestedPlan === 'business' ? 'business' : 'pro'
	const initialPeriod =
		searchParams.get('period') === 'annual' ? 'annual' : 'monthly'

	const [plan, setPlan] = useState<'pro' | 'business'>(initialPlan)
	const [billingPeriod, setBillingPeriod] =
		useState<BillingPeriod>(initialPeriod)
	const [confirmOpen, setConfirmOpen] = useState(false)

	const planPricing = checkoutOptions[plan]
	const selectedPrice = useMemo(
		() => checkoutOptions[plan][billingPeriod],
		[checkoutOptions, plan, billingPeriod]
	)
	const annualSavings = useMemo(
		() => computeAnnualSavings(planPricing),
		[planPricing]
	)
	const unlockedFeatures = useMemo(
		() => getUnlockedFeatures(billing.plan, plan),
		[billing.plan, plan]
	)

	// Whether this selection will skip Stripe's hosted checkout and update
	// the subscription in-place — mirrors the server-side route decision.
	const isDirectUpdate = billing.billingState === 'active'

	useEffect(() => {
		posthog?.capture('view_pricing', { source: 'settings', plan: billing.plan })
	}, [posthog, billing.plan])

	type CheckoutFetcherResponse = {
		data: {
			redirectUrl: string
		}
	}

	const hasCheckoutUrl = (value: unknown): value is CheckoutFetcherResponse => {
		if (!value || typeof value !== 'object' || !('data' in value)) {
			return false
		}

		const { data } = value as { data: unknown }

		if (!data || typeof data !== 'object' || !('redirectUrl' in data)) {
			return false
		}

		return typeof (data as { redirectUrl: unknown }).redirectUrl === 'string'
	}

	useEffect(() => {
		if (
			checkoutFetcher.state !== 'idle' ||
			!hasCheckoutUrl(checkoutFetcher.data)
		) {
			return
		}

		window.location.href = checkoutFetcher.data.data.redirectUrl
	}, [checkoutFetcher.state, checkoutFetcher.data])

	const checkoutError =
		checkoutFetcher.state === 'idle' &&
		checkoutFetcher.data &&
		typeof checkoutFetcher.data === 'object' &&
		'success' in checkoutFetcher.data &&
		checkoutFetcher.data.success === false &&
		'error' in checkoutFetcher.data
			? String(checkoutFetcher.data.error)
			: null

	// Close confirmation dialog when an error comes back
	useEffect(() => {
		if (checkoutError) setConfirmOpen(false)
	}, [checkoutError])

	const submitCheckout = () => {
		if (!selectedPrice) return
		setConfirmOpen(false)
		posthog?.capture('plan_upgrade_started', {
			from_plan: billing.plan,
			to_plan: plan,
			billing_period: billingPeriod,
			trigger: searchParams.get('trigger') ?? 'settings'
		})
		checkoutFetcher.submit(
			JSON.stringify({
				planId: plan,
				priceId: selectedPrice.priceId,
				billingPeriod
			}),
			{
				method: 'POST',
				action: '/api/billing/checkout',
				encType: 'application/json'
			}
		)
	}

	const isSubmitting = checkoutFetcher.state !== 'idle'

	const displayPriceCents =
		billingPeriod === 'annual' && annualSavings
			? annualSavings.monthlyEquivalentCents
			: (selectedPrice?.amountCents ?? null)

	return (
		<>
			<div className="relative mx-auto max-h-screen w-full max-w-7xl space-y-10 overflow-auto px-6 py-6 pb-44 md:max-h-[80vh]">
				<PricingCardsSection
					period={billingPeriod}
					onPeriodChange={setBillingPeriod}
					prices={checkoutOptions}
					showEnterprise={false}
					activePlan={billing.plan}
					selectedPlan={plan}
					selectablePlans={['pro', 'business']}
					onSelectPlan={(nextPlan) => {
						if (nextPlan === 'pro' || nextPlan === 'business') {
							setPlan(nextPlan)
						}
					}}
				/>

				{unlockedFeatures.length > 0 && (
					<div className="relative space-y-2">
						<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
							Newly unlocked for your workspace
						</p>
						<div className="text-muted-foreground text-sm">
							{unlockedFeatures.join(' · ')}
						</div>
					</div>
				)}

				<Card className="border-primary/20 bg-muted/75 sticky top-0 left-0 z-50 w-full py-0 shadow-lg backdrop-blur-md">
					<CardContent className="space-y-3 p-4">
						{checkoutError && (
							<div className="bg-destructive/5 border-destructive/20 flex items-start gap-2 rounded-lg border p-3">
								<AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
								<p className="text-destructive text-sm">{checkoutError}</p>
							</div>
						)}

						{!checkoutEnabled && (
							<div className="bg-muted border-border flex items-start gap-2 rounded-lg border p-3">
								<AlertTriangle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
								<p className="text-muted-foreground text-sm">
									Checkout is temporarily unavailable. Please try again later or{' '}
									<a
										href="mailto:info@vectreal.com"
										className="underline underline-offset-2"
									>
										contact support
									</a>
									.
								</p>
							</div>
						)}

						<div className="flex justify-between gap-4 max-md:flex-col">
							<div className="flex flex-col gap-1">
								<span className="flex grow flex-col">
									<p className="text-sm font-medium">
										Selected: {PLAN_LABELS[plan]} ·{' '}
										{billingPeriod === 'annual' ? 'Annual' : 'Monthly'}
									</p>

									{selectedPrice ? (
										<p className="text-muted-foreground text-xs">
											{displayPriceCents !== null
												? formatCurrency(
														displayPriceCents,
														selectedPrice.currency
													)
												: '—'}
											/month
											{billingPeriod === 'annual' && annualSavings
												? ` · ${formatCurrency(selectedPrice.amountCents, selectedPrice.currency)} billed yearly`
												: ''}
										</p>
									) : (
										<p className="text-muted-foreground text-xs">
											Pricing unavailable for this selection.
										</p>
									)}
								</span>

								<Link
									to="/dashboard/billing"
									className="text-muted-foreground hover:text-foreground flex w-fit gap-1 text-xs whitespace-nowrap transition-colors"
								>
									<ChevronLeft className="h-4 w-4" />
									Back to billing
								</Link>
							</div>

							<div className="flex flex-col justify-between gap-3">
								<Button
									size="lg"
									className="w-full gap-2"
									onClick={
										isDirectUpdate ? () => setConfirmOpen(true) : submitCheckout
									}
									disabled={!selectedPrice || isSubmitting || !checkoutEnabled}
								>
									{isSubmitting ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											{isDirectUpdate ? 'Updating…' : 'Opening Stripe…'}
										</>
									) : isDirectUpdate ? (
										<>
											Update plan
											<ArrowRight className="h-4 w-4" />
										</>
									) : (
										<>
											Continue to payment
											<ArrowRight className="h-4 w-4" />
										</>
									)}
								</Button>

								<div className="flex items-center gap-1.5">
									<Lock className="text-muted-foreground h-3 w-3" />
									<p className="text-muted-foreground text-xs">
										Secured by Stripe · Cancel anytime
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<FeatureCompareGrid />
			</div>

			{/* Confirmation dialog — only shown for direct subscription updates (active plan) */}
			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Confirm plan change</DialogTitle>
						<DialogDescription>
							Your subscription will be updated immediately. Any unused time on
							your current billing period will be prorated to your next invoice.
						</DialogDescription>
					</DialogHeader>

					{/* Change summary */}
					<div className="bg-muted space-y-2 rounded-lg p-4 text-sm">
						{billing.plan !== plan && (
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground">
									{PLAN_LABELS[billing.plan]}
								</span>
								<ArrowRight className="text-muted-foreground h-3.5 w-3.5" />
								<span className="font-medium">{PLAN_LABELS[plan]}</span>
							</div>
						)}
						<div className="font-medium">
							{PLAN_LABELS[plan]} ·{' '}
							{billingPeriod === 'annual' ? 'Annual' : 'Monthly'}
						</div>
						{selectedPrice && displayPriceCents !== null && (
							<div className="text-muted-foreground">
								{formatCurrency(displayPriceCents, selectedPrice.currency)}
								/month
								{billingPeriod === 'annual' &&
									annualSavings &&
									` · ${formatCurrency(selectedPrice.amountCents, selectedPrice.currency)} billed annually`}
							</div>
						)}
						{billingPeriod === 'annual' && annualSavings && selectedPrice && (
							<div className="text-primary font-medium">
								Save{' '}
								{formatCurrency(
									annualSavings.yearlySavingsCents,
									selectedPrice.currency
								)}{' '}
								/ year vs monthly
							</div>
						)}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmOpen(false)}>
							Cancel
						</Button>
						<Button onClick={submitCheckout} disabled={!selectedPrice}>
							Confirm change
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
