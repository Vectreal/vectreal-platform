/**
 * PricingCardsSection
 * Shared component used on both the public pricing page and the dashboard
 * upgrade route. Renders the billing-period toggle and the plan cards row.
 *
 * Props
 * ─────
 * period / onPeriodChange   – controlled billing-period state
 * prices                    – live Stripe prices (nullable when unavailable)
 * showEnterprise            – renders the Enterprise card (default true)
 * activePlan                – the user's current plan; shown as "Current plan"
 * selectedPlan              – card shown as selected/highlighted
 * onSelectPlan              – when provided, cards are interactive selectors
 *                             instead of navigation links
 */

import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { cn } from '@shared/utils'
import { Check, Minus, Zap } from 'lucide-react'
import { Link } from 'react-router'

import { PLAN_LIMITS, type Plan } from '../../../constants/plan-config'

import type { BillingCheckoutOptions } from '../../../lib/domain/dashboard/dashboard-types'

// ---------------------------------------------------------------------------
// Static plan display config
// ---------------------------------------------------------------------------

const PLAN_DISPLAY: Record<
	Plan,
	{
		name: string
		tagline: string
		monthlyPrice: number | null
		annualMonthlyPrice: number | null
		highlighted: boolean
		cta: string
		ctaHref: string | null
	}
> = {
	free: {
		name: 'Free',
		tagline: 'For hobbyists and open-source projects',
		monthlyPrice: 0,
		annualMonthlyPrice: 0,
		highlighted: false,
		cta: 'Get started free',
		ctaHref: '/sign-up'
	},
	pro: {
		name: 'Pro',
		tagline: 'For independent creators and small studios',
		monthlyPrice: 29,
		annualMonthlyPrice: 23,
		highlighted: true,
		cta: 'Start with Pro',
		ctaHref: null
	},
	business: {
		name: 'Business',
		tagline: 'For growing teams and agencies',
		monthlyPrice: 79,
		annualMonthlyPrice: 63,
		highlighted: false,
		cta: 'Start with Business',
		ctaHref: null
	},
	enterprise: {
		name: 'Enterprise',
		tagline: 'Custom SLA and dedicated support',
		monthlyPrice: null,
		annualMonthlyPrice: null,
		highlighted: false,
		cta: 'Contact sales',
		ctaHref: '/contact'
	}
}

const HIGHLIGHTED_LIMITS: Array<{
	key: keyof (typeof PLAN_LIMITS)['free']
	label: string
	format: (v: number | null) => string
}> = [
	{
		key: 'storage_bytes_total',
		label: 'Storage',
		format: (v) => {
			if (v === null) return 'Custom'
			const gb = v / (1024 * 1024 * 1024)
			if (gb >= 1) return `${gb.toLocaleString()} GB`
			return `${(v / (1024 * 1024)).toLocaleString()} MB`
		}
	},
	{
		key: 'scenes_total',
		label: 'Scenes',
		format: (v) => (v === null ? 'Unlimited' : v.toLocaleString())
	},
	{
		key: 'scenes_published_concurrent',
		label: 'Published scenes',
		format: (v) => (v === null ? 'Unlimited' : v.toLocaleString())
	},
	{
		key: 'projects_total',
		label: 'Projects',
		format: (v) => (v === null ? 'Unlimited' : v.toLocaleString())
	},
	{
		key: 'optimization_runs_per_month',
		label: 'Optimization runs / month',
		format: (v) => (v === null ? 'Unlimited' : v.toLocaleString())
	},
	{
		key: 'org_seats',
		label: 'Team seats',
		format: (v) => (v === null ? 'Unlimited' : v.toLocaleString())
	}
]

// ---------------------------------------------------------------------------
// PlanCard
// ---------------------------------------------------------------------------

interface PlanCardProps {
	plan: Plan
	period: 'monthly' | 'annual'
	prices: BillingCheckoutOptions | null
	/** The user's currently active plan — shows "Current plan" badge */
	activePlan?: Plan
	/** The plan currently selected for checkout — shows highlighted ring */
	selectedPlan?: Plan
	/** Called when the card CTA is clicked in select mode */
	onSelectPlan?: (plan: Plan) => void
	/** In select mode, only these plans can be actively selected */
	selectablePlans?: Plan[]
}

function formatCurrency(amountCents: number, currency: string) {
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: currency.toUpperCase(),
		maximumFractionDigits: 0
	}).format(amountCents / 100)
}

function PlanCard({
	plan,
	period,
	prices,
	activePlan,
	selectedPlan,
	onSelectPlan,
	selectablePlans
}: PlanCardProps) {
	const display = PLAN_DISPLAY[plan]
	const limits = PLAN_LIMITS[plan]

	const isEnterprise = plan === 'enterprise'
	const isFree = plan === 'free'
	const isPaid = plan === 'pro' || plan === 'business'
	const isActive = plan === activePlan
	const isSelected = selectedPlan !== undefined ? plan === selectedPlan : false
	const isSelectableInSelectMode = selectablePlans
		? selectablePlans.includes(plan)
		: true

	const livePricing =
		isPaid && prices ? prices[plan as 'pro' | 'business'] : null
	const liveMonthlyAmountCents = livePricing?.monthly?.amountCents ?? null
	const liveAnnualAmountCents = livePricing?.annual?.amountCents ?? null
	const liveCurrency =
		livePricing?.monthly?.currency ?? livePricing?.annual?.currency ?? 'usd'

	const displayAmountCents =
		period === 'monthly'
			? liveMonthlyAmountCents
			: liveAnnualAmountCents !== null
				? Math.round(liveAnnualAmountCents / 12)
				: null

	const savingsPct =
		liveMonthlyAmountCents !== null &&
		liveAnnualAmountCents !== null &&
		liveMonthlyAmountCents !== 0
			? Math.round(
					(1 - liveAnnualAmountCents / 12 / liveMonthlyAmountCents) * 100
				)
			: null

	const staticMonthlyPrice = display.monthlyPrice
	const staticAnnualMonthlyPrice = display.annualMonthlyPrice

	// In select mode, this plan is clickable as a selector
	const isSelectMode = onSelectPlan !== undefined
	const isSelectable = !isSelectMode || isSelectableInSelectMode

	return (
		<Card
			className={cn(
				'flex flex-col transition-all',
				// Highlighted ring: selected (on upgrade route) or "most popular" (pricing page)
				isSelected && 'border-primary ring-primary ring-2',
				display.highlighted &&
					!isSelectMode &&
					'border-primary ring-primary ring-2',
				// Dimmed when another plan is selected
				isSelectMode && selectedPlan && !isSelected && 'opacity-60',
				isSelectMode &&
					!isActive &&
					isSelectable &&
					'cursor-pointer hover:opacity-100'
			)}
			onClick={
				isSelectMode && !isActive && isSelectable
					? () => onSelectPlan(plan)
					: undefined
			}
		>
			<CardHeader className="space-y-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-xl">{display.name}</CardTitle>
					<div className="flex items-center gap-1.5">
						{isActive && (
							<Badge variant="secondary" className="text-xs">
								Current plan
							</Badge>
						)}
						{isSelected && !isActive && (
							<Badge className="bg-primary text-primary-foreground text-xs">
								Selected
							</Badge>
						)}
						{display.highlighted && !isSelectMode && (
							<Badge className="bg-primary text-primary-foreground">
								Most popular
							</Badge>
						)}
					</div>
				</div>
				<CardDescription>{display.tagline}</CardDescription>
				<div className="pt-2">
					{isEnterprise ? (
						<p className="text-2xl font-medium">Custom</p>
					) : isFree ? (
						<div>
							<span className="text-4xl">$0</span>
							<span className="text-muted-foreground ml-1 text-sm">/month</span>
						</div>
					) : (
						<div>
							{displayAmountCents !== null ? (
								<div className="flex items-end gap-2">
									<span className="text-4xl font-medium">
										{formatCurrency(displayAmountCents, liveCurrency)}
									</span>
									<span className="text-muted-foreground mb-1 text-sm">
										/month
									</span>
									{period === 'annual' && savingsPct && savingsPct > 0 && (
										<Badge variant="secondary" className="mb-1">
											Save {savingsPct}%
										</Badge>
									)}
								</div>
							) : (
								<div className="flex items-end gap-2">
									<span className="text-4xl font-medium">
										$
										{period === 'annual'
											? (staticAnnualMonthlyPrice ?? staticMonthlyPrice)
											: staticMonthlyPrice}
									</span>
									<span className="text-muted-foreground mb-1 text-sm">
										/month
									</span>
								</div>
							)}
							{period === 'annual' && liveAnnualAmountCents !== null && (
								<p className="text-muted-foreground mt-1 text-xs">
									{formatCurrency(liveAnnualAmountCents, liveCurrency)} billed
									annually
								</p>
							)}
						</div>
					)}
				</div>
			</CardHeader>

			<CardContent className="flex-1 space-y-3">
				{HIGHLIGHTED_LIMITS.map(({ key, label, format }) => (
					<div key={key} className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">{label}</span>
						<span className="font-medium">{format(limits[key])}</span>
					</div>
				))}
			</CardContent>

			{/* CTA footer — hidden in select mode for current plan; otherwise shown */}
			{!isSelectMode && (
				<CardFooter>
					{display.ctaHref ? (
						<Link to={display.ctaHref} className="w-full">
							<Button
								className="w-full"
								variant={display.highlighted ? 'default' : 'outline'}
							>
								{display.highlighted && <Zap className="mr-2 h-4 w-4" />}
								{display.cta}
							</Button>
						</Link>
					) : (
						<Link
							to={`/dashboard/billing/upgrade?plan=${plan}&period=${period}`}
							className="w-full"
						>
							<Button
								className="w-full"
								variant={display.highlighted ? 'default' : 'outline'}
							>
								{display.highlighted && <Zap className="mr-2 h-4 w-4" />}
								{display.cta}
							</Button>
						</Link>
					)}
				</CardFooter>
			)}
			{isSelectMode && !isActive && isSelectable && (
				<CardFooter>
					<Button
						className="w-full"
						variant={isSelected ? 'default' : 'outline'}
						onClick={(e) => {
							e.stopPropagation()
							onSelectPlan(plan)
						}}
					>
						{isSelected && <Check className="mr-2 h-4 w-4" />}
						{isSelected
							? 'Selected'
							: isEnterprise
								? 'Contact sales'
								: `Select ${display.name}`}
					</Button>
				</CardFooter>
			)}
			{isSelectMode && !isActive && !isSelectable && (
				<CardFooter>
					<Button className="w-full" variant="ghost" disabled>
						Not available for checkout
					</Button>
				</CardFooter>
			)}
			{isSelectMode && isActive && (
				<CardFooter>
					<Button className="w-full" variant="ghost" disabled>
						<Minus className="mr-2 h-4 w-4" />
						Current plan
					</Button>
				</CardFooter>
			)}
		</Card>
	)
}

// ---------------------------------------------------------------------------
// PricingCardsSection (exported)
// ---------------------------------------------------------------------------

const ALL_PLANS: Plan[] = ['free', 'pro', 'business', 'enterprise']
const PLANS_WITHOUT_ENTERPRISE: Plan[] = ['free', 'pro', 'business']

export interface PricingCardsSectionProps {
	period: 'monthly' | 'annual'
	onPeriodChange: (period: 'monthly' | 'annual') => void
	prices: BillingCheckoutOptions | null
	/** Include the Enterprise card (default true) */
	showEnterprise?: boolean
	/** User's current plan — shows "Current plan" badge */
	activePlan?: Plan
	/** Plan currently selected for checkout — highlighted ring */
	selectedPlan?: Plan
	/** If provided, cards become interactive selectors */
	onSelectPlan?: (plan: Plan) => void
	/** In select mode, limit selectable plans */
	selectablePlans?: Plan[]
}

export function PricingCardsSection({
	period,
	onPeriodChange,
	prices,
	showEnterprise = true,
	activePlan,
	selectedPlan,
	onSelectPlan,
	selectablePlans
}: PricingCardsSectionProps) {
	const plans = showEnterprise ? ALL_PLANS : PLANS_WITHOUT_ENTERPRISE

	return (
		<section>
			{/* Billing period toggle */}
			<div className="mb-8 flex justify-center">
				<div className="bg-muted flex items-center gap-1 rounded-lg p-1">
					<button
						type="button"
						onClick={() => onPeriodChange('monthly')}
						className={cn(
							'rounded-md px-4 py-1.5 text-sm font-medium transition-all',
							period === 'monthly'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						Monthly
					</button>
					<button
						type="button"
						onClick={() => onPeriodChange('annual')}
						className={cn(
							'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all',
							period === 'annual'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						Annual
						<Badge variant="secondary" className="text-xs">
							Save up to 20%
						</Badge>
					</button>
				</div>
			</div>

			<div
				className={cn(
					'grid gap-6',
					plans.length === 4
						? 'sm:grid-cols-2 xl:grid-cols-4'
						: 'sm:grid-cols-3'
				)}
			>
				{plans.map((plan) => (
					<PlanCard
						key={plan}
						plan={plan}
						period={period}
						prices={prices}
						activePlan={activePlan}
						selectedPlan={selectedPlan}
						onSelectPlan={onSelectPlan}
						selectablePlans={selectablePlans}
					/>
				))}
			</div>
		</section>
	)
}
