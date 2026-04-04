import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { cn } from '@shared/utils'
import {
	AlertTriangle,
	BriefcaseBusiness,
	Check,
	Loader2,
	ShieldCheck,
	Sparkles,
	Zap
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
	data,
	Link,
	useFetcher,
	useLoaderData,
	useSearchParams
} from 'react-router'

import { Route } from './+types/billing-checkout'
import { RadioAccordion } from '../../components/radio-accordion'
import {
	PLAN_ENTITLEMENTS,
	PLAN_LIMITS,
	type Plan
} from '../../constants/plan-config'
import { loadBillingDashboardData } from '../../lib/domain/billing/billing-dashboard-loader.server'

import type { Option } from '../../components/radio-accordion'
import type {
	BillingCheckoutOption,
	BillingCheckoutPeriods
} from '../../lib/domain/dashboard/dashboard-types'

const PLAN_LABELS = {
	free: 'Free',
	pro: 'Pro',
	business: 'Business',
	enterprise: 'Enterprise'
} as const

const PLAN_OPTIONS: Option<'pro' | 'business'>[] = [
	{
		id: 'pro',
		label: 'Pro',
		description:
			'Built for independent creators and small studios that need more headroom without added complexity.',
		icon: <Zap className="h-4 w-4" />
	},
	{
		id: 'business',
		label: 'Business',
		description:
			'Built for teams that want collaboration controls, faster throughput, and priority support.',
		icon: <BriefcaseBusiness className="h-4 w-4" />
	}
]

const PLAN_BENEFITS: Record<'pro' | 'business', string[]> = {
	pro: [
		'Private preview links and version history',
		'Custom optimization parameters and high-quality preset',
		'Viewer customization and embed analytics',
		'Email support with faster response times'
	],
	business: [
		'Everything in Pro, plus team members and role-based access',
		'Priority optimization queue for faster iteration',
		'Higher API capacity and more API keys for integrations',
		'Priority support and stronger collaboration workflows'
	]
}

type BillingPeriod = 'monthly' | 'annual'

function formatCurrency(amountCents: number, currency: string) {
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: currency.toUpperCase(),
		maximumFractionDigits: 0
	}).format(amountCents / 100)
}

function formatBytes(bytes: number | null) {
	if (bytes === null) {
		return 'Unlimited'
	}

	const gb = bytes / (1024 * 1024 * 1024)
	if (gb >= 1) {
		return `${gb.toLocaleString()} GB`
	}

	const mb = bytes / (1024 * 1024)
	return `${mb.toLocaleString()} MB`
}

function formatLimit(value: number | null) {
	if (value === null) {
		return 'Unlimited'
	}

	return value.toLocaleString()
}

function getPlanHighlights(plan: 'pro' | 'business') {
	const limits = PLAN_LIMITS[plan]

	return [
		{ label: 'Storage', value: formatBytes(limits.storage_bytes_total) },
		{ label: 'Scenes', value: formatLimit(limits.scenes_total) },
		{ label: 'Projects', value: formatLimit(limits.projects_total) },
		{
			label: 'Optimization runs / month',
			value: formatLimit(limits.optimization_runs_per_month)
		},
		{ label: 'Team seats', value: formatLimit(limits.org_seats) }
	]
}

function getUnlockedFeatures(
	currentPlan: Plan,
	selectedPlan: 'pro' | 'business'
) {
	if (currentPlan === selectedPlan) {
		return []
	}

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

	const unlocked = Object.keys(selectedEntitlements)
		.filter((key) => {
			const typedKey = key as keyof typeof selectedEntitlements
			return selectedEntitlements[typedKey] && !currentEntitlements[typedKey]
		})
		.map((key) => labels[key as keyof typeof labels])
		.filter((label, index, all) => all.indexOf(label) === index)

	return unlocked.slice(0, 5)
}

function computeAnnualSavings(pricing: BillingCheckoutPeriods) {
	if (!pricing.monthly || !pricing.annual) {
		return null
	}

	const monthlyYearlyCost = pricing.monthly.amountCents * 12
	const annualCost = pricing.annual.amountCents
	if (monthlyYearlyCost <= annualCost) {
		return null
	}

	return {
		yearlySavingsCents: monthlyYearlyCost - annualCost,
		monthlyEquivalentCents: Math.round(annualCost / 12)
	}
}

function PeriodOptionButton({
	period,
	selected,
	onClick,
	pricing,
	savings
}: {
	period: BillingPeriod
	selected: boolean
	onClick: () => void
	pricing: BillingCheckoutOption | null
	savings: ReturnType<typeof computeAnnualSavings>
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!pricing}
			className={cn(
				'rounded-xl border p-3 text-left transition',
				selected
					? 'border-primary bg-primary/5'
					: 'border-border hover:border-primary/40 hover:bg-muted/40',
				!pricing && 'opacity-50'
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-sm font-medium">
						{period === 'monthly' ? 'Monthly billing' : 'Annual billing'}
					</p>
					{pricing ? (
						<p className="text-muted-foreground mt-1 text-xs">
							{period === 'monthly'
								? `${formatCurrency(pricing.amountCents, pricing.currency)} charged each month`
								: `${formatCurrency(Math.round(pricing.amountCents / 12), pricing.currency)} / month billed annually as ${formatCurrency(pricing.amountCents, pricing.currency)} / year`}
						</p>
					) : (
						<p className="text-muted-foreground mt-1 text-xs">
							Not available yet
						</p>
					)}
				</div>
				{period === 'annual' && savings && (
					<Badge variant="secondary" className="shrink-0">
						Save{' '}
						{formatCurrency(
							savings.yearlySavingsCents,
							pricing?.currency ?? 'usd'
						)}{' '}
						/ year
					</Badge>
				)}
			</div>
		</button>
	)
}

export async function loader({ request }: Route.LoaderArgs) {
	const { loaderData, headers } = await loadBillingDashboardData(request)
	return data(loaderData, { headers })
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function BillingCheckoutPage() {
	const { checkoutOptions, billing } = useLoaderData<typeof loader>()
	const [searchParams] = useSearchParams()
	const checkoutFetcher = useFetcher()

	const requestedPlan = searchParams.get('plan')
	const initialPlan = requestedPlan === 'business' ? 'business' : 'pro'
	const initialPeriod =
		searchParams.get('period') === 'annual' ? 'annual' : 'monthly'

	const [plan, setPlan] = useState<'pro' | 'business'>(initialPlan)
	const [billingPeriod, setBillingPeriod] =
		useState<BillingPeriod>(initialPeriod)

	const planPricing = checkoutOptions[plan]
	const selectedPrice = useMemo(
		() => checkoutOptions[plan][billingPeriod],
		[checkoutOptions, plan, billingPeriod]
	)
	const selectedPlanOption = useMemo(
		() => PLAN_OPTIONS.find((option) => option.id === plan),
		[plan]
	)
	const annualSavings = useMemo(
		() => computeAnnualSavings(planPricing),
		[planPricing]
	)
	const highlights = useMemo(() => getPlanHighlights(plan), [plan])
	const unlockedFeatures = useMemo(
		() => getUnlockedFeatures(billing.plan, plan),
		[billing.plan, plan]
	)

	useEffect(() => {
		if (
			checkoutFetcher.state === 'idle' &&
			checkoutFetcher.data &&
			typeof checkoutFetcher.data === 'object' &&
			'data' in checkoutFetcher.data &&
			checkoutFetcher.data.data &&
			typeof checkoutFetcher.data.data === 'object' &&
			'checkoutUrl' in (checkoutFetcher.data.data as object)
		) {
			const checkoutUrl = (checkoutFetcher.data.data as { checkoutUrl: string })
				.checkoutUrl
			window.location.href = checkoutUrl
		}
	}, [checkoutFetcher.state, checkoutFetcher.data])

	const handleStartCheckout = () => {
		if (!selectedPrice) {
			return
		}

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

	const checkoutError =
		checkoutFetcher.state === 'idle' &&
		checkoutFetcher.data &&
		typeof checkoutFetcher.data === 'object' &&
		'success' in checkoutFetcher.data &&
		checkoutFetcher.data.success === false &&
		'error' in checkoutFetcher.data
			? String(checkoutFetcher.data.error)
			: null

	const handleSelectPlanOption = (option: Option<'pro' | 'business'>) => {
		setPlan(option.id)
	}

	const primaryPriceCents =
		billingPeriod === 'annual' && annualSavings
			? annualSavings.monthlyEquivalentCents
			: (selectedPrice?.amountCents ?? null)

	const selectedChargeLabel =
		billingPeriod === 'monthly'
			? 'Per month, billed monthly'
			: 'Per month, billed annually'

	return (
		<div className="mx-auto grid w-full max-w-6xl gap-6 p-6 lg:grid-cols-[2fr_1fr]">
			<div className="space-y-6">
				<Card className="border-primary/20 from-background via-background to-primary/5 bg-gradient-to-br">
					<CardHeader className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary" className="gap-1.5">
								<Sparkles className="h-3.5 w-3.5" />
								No hidden steps
							</Badge>
							<Badge variant="outline" className="gap-1.5">
								<ShieldCheck className="h-3.5 w-3.5" />
								Secure checkout with Stripe
							</Badge>
						</div>
						<CardTitle>Choose your plan and review the exact price</CardTitle>
						<CardDescription>
							Everything is shown before you pay: plan benefits, billing
							cadence, and what you can change later.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<RadioAccordion
							options={PLAN_OPTIONS}
							selectedOption={selectedPlanOption}
							onSelectPreset={handleSelectPlanOption}
							label="Pick the plan that fits your workflow"
							description="You can switch or cancel later from billing settings, so choose what feels right for now."
						/>

						<div className="space-y-2">
							<Label>Billing cadence</Label>
							<div className="grid gap-3 sm:grid-cols-2">
								<PeriodOptionButton
									period="monthly"
									selected={billingPeriod === 'monthly'}
									onClick={() => setBillingPeriod('monthly')}
									pricing={planPricing.monthly}
									savings={annualSavings}
								/>
								<PeriodOptionButton
									period="annual"
									selected={billingPeriod === 'annual'}
									onClick={() => setBillingPeriod('annual')}
									pricing={planPricing.annual}
									savings={annualSavings}
								/>
							</div>
						</div>

						{selectedPrice && (
							<div className="border-primary/30 bg-background rounded-xl border p-4">
								<p className="text-sm font-medium">What you will pay</p>
								<div className="mt-2 flex flex-wrap items-end justify-between gap-2">
									<div>
										<p className="text-2xl font-semibold">
											{primaryPriceCents === null
												? 'N/A'
												: formatCurrency(
														primaryPriceCents,
														selectedPrice.currency
													)}
										</p>
										<p className="text-muted-foreground text-xs">
											{selectedChargeLabel}
										</p>
									</div>
									{billingPeriod === 'annual' && annualSavings && (
										<div className="text-right">
											<p className="text-sm font-medium">
												{formatCurrency(
													selectedPrice.amountCents,
													selectedPrice.currency
												)}{' '}
												billed yearly
											</p>
											<p className="text-sm font-medium">
												Save{' '}
												{formatCurrency(
													annualSavings.yearlySavingsCents,
													selectedPrice.currency
												)}
												per year
											</p>
										</div>
									)}
								</div>
								<p className="text-muted-foreground mt-3 text-xs">
									Taxes may apply based on your location. Final amount is always
									shown in Stripe before confirming payment.
								</p>
							</div>
						)}

						{!selectedPrice && (
							<p className="text-destructive text-sm">
								This billing option is not available yet. Try another cadence.
							</p>
						)}

						{checkoutError && (
							<p className="text-destructive flex items-center gap-1.5 text-sm">
								<AlertTriangle className="h-4 w-4" />
								{checkoutError}
							</p>
						)}

						<div className="space-y-3 pt-2">
							<div className="flex flex-wrap gap-2">
								<Link to="/dashboard/billing">
									<Button variant="ghost">Back to billing</Button>
								</Link>
								<Button
									onClick={handleStartCheckout}
									disabled={!selectedPrice || checkoutFetcher.state !== 'idle'}
								>
									{checkoutFetcher.state !== 'idle' && (
										<Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
									)}
									Continue to secure checkout
								</Button>
							</div>
							<p className="text-muted-foreground text-xs">
								You can cancel or change your plan any time from billing
								settings.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							What you unlock with {PLAN_LABELS[plan]}
						</CardTitle>
						<CardDescription>
							A quick, honest summary of what changes when you upgrade.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						<div className="space-y-2">
							{PLAN_BENEFITS[plan].map((benefit) => (
								<div key={benefit} className="flex items-start gap-2">
									<Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
									<span>{benefit}</span>
								</div>
							))}
						</div>

						<Separator />

						<div className="space-y-2">
							<p className="text-muted-foreground text-xs tracking-wide uppercase">
								Plan limits at a glance
							</p>
							{highlights.map((highlight) => (
								<div
									key={highlight.label}
									className="flex items-center justify-between"
								>
									<span className="text-muted-foreground">
										{highlight.label}
									</span>
									<span className="font-medium">{highlight.value}</span>
								</div>
							))}
						</div>

						{unlockedFeatures.length > 0 && (
							<>
								<Separator />
								<div className="space-y-2">
									<p className="text-muted-foreground text-xs tracking-wide uppercase">
										New for your current workspace
									</p>
									<div className="flex flex-wrap gap-1.5">
										{unlockedFeatures.map((feature) => (
											<Badge key={feature} variant="outline">
												{feature}
											</Badge>
										))}
									</div>
								</div>
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							Need the full comparison?
						</CardTitle>
						<CardDescription>
							Take a look at every feature and limit side-by-side before
							checkout.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link to="/pricing">
							<Button variant="outline" className="w-full">
								Compare all plans
							</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
