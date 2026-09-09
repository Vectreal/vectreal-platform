/**
 * PricingCardsSection
 * Shared component used on both the public pricing page and the dashboard
 * upgrade route. Renders the billing-period toggle and the plan cards row.
 *
 * Props
 * ─────
 * period / onPeriodChange   – controlled billing-period state
 * prices                    – live Stripe prices (nullable when unavailable)
 * activePlan                – the user's current plan; shown as "Current plan"
 * selectedPlan              – card shown as selected/highlighted
 * onSelectPlan              – when provided, cards are interactive selectors
 *                             instead of navigation links
 */

import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader
} from '@shared/components/ui/card'
import { cn } from '@shared/utils'
import { Check, Minus } from 'lucide-react'
import { Link } from 'react-router'

import { formatLimitValue } from '../../constants/limit-format'
import { PLAN_LIMITS, type Plan } from '../../constants/plan-config'
import {
	ANNUAL_DISCOUNT_CLAIM,
	LIMIT_DISPLAY_LABELS,
	PLAN_CARD_LIMIT_KEYS,
	PLAN_CTA,
	PLAN_CTA_HREF,
	PLAN_DISPLAY_NAMES,
	PLAN_FALLBACK_PRICES,
	PLAN_HIGHLIGHTED,
	PLAN_TAGLINES
} from '../../constants/product-copy'
import { BasicCard } from '../layout-components'

import type { BillingCheckoutOptions } from '../../lib/domain/dashboard/dashboard-types'

// ---------------------------------------------------------------------------
// Limit display config — labels and formatting both come from constants
// ---------------------------------------------------------------------------

const HIGHLIGHTED_LIMITS = PLAN_CARD_LIMIT_KEYS.map((key) => ({
	key: key as keyof (typeof PLAN_LIMITS)['free'],
	label: LIMIT_DISPLAY_LABELS[key],
	format: (v: number | null) => formatLimitValue(key, v)
}))

// ---------------------------------------------------------------------------
// PlanCard
// ---------------------------------------------------------------------------

interface PlanCardProps {
	plan: Plan
	period: 'monthly' | 'annual'
	prices: BillingCheckoutOptions | null
	/** The user's currently active plan - shows "Current plan" badge */
	activePlan?: Plan
	/** The plan currently selected for checkout - shows highlighted ring */
	selectedPlan?: Plan
	/** Called when the card CTA is clicked in select mode */
	onSelectPlan?: (plan: Plan) => void
	/** In select mode, only these plans can be actively selected */
	selectablePlans?: Plan[]
}

/*
  The locale is pinned, not left to resolve.

  `undefined` means "the runtime default", and the runtime differs on the two
  sides of hydration: the container declares no LANG, so the server formats one
  way and the visitor's browser formats another. Every price on the page is then
  a hydration mismatch for anyone outside the container's default locale.
  `product-copy.ts` pins OFFER_LOCALE for the same reason and writes the
  reasoning out at length; this is the same decision at a call site that missed
  it.
*/
const PRICE_LOCALE = 'en-US'

function formatCurrency(amountCents: number, currency: string) {
	return new Intl.NumberFormat(PRICE_LOCALE, {
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
	const limits = PLAN_LIMITS[plan]
	const name = PLAN_DISPLAY_NAMES[plan]
	const tagline = PLAN_TAGLINES[plan]
	const cta = PLAN_CTA[plan]
	const ctaHref = PLAN_CTA_HREF[plan]
	const highlighted = PLAN_HIGHLIGHTED[plan]
	const fallbackPrices = PLAN_FALLBACK_PRICES[plan]

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

	const staticMonthlyPrice = fallbackPrices?.monthly ?? null
	const staticAnnualMonthlyPrice = fallbackPrices?.annualMonthly ?? null

	// In select mode, this plan is clickable as a selector
	const isSelectMode = onSelectPlan !== undefined
	const isSelectable = !isSelectMode || isSelectableInSelectMode

	return (
		<BasicCard
			highlight={isSelected || highlighted || undefined}
			/*
			  No bg-muted here. It was a second signal for the same thing highlight
			  already says, and it is a utility while the ladder is a component
			  class - so the recommended card left the ladder and rendered a plate
			  its neighbours could not match. highlight now steps it to 8%.
			*/
			cardClassName={cn(
				'transition-all',
				// Dimmed when another plan is selected
				isSelectMode && selectedPlan && !isSelected && 'opacity-60',
				isSelectMode &&
					!isActive &&
					isSelectable &&
					'cursor-pointer hover:opacity-100'
			)}
			className="flex flex-col"
			onClick={
				isSelectMode && !isActive && isSelectable
					? () => onSelectPlan(plan)
					: undefined
			}
		>
			<CardHeader className="space-y-2">
				<div className="flex items-center justify-between">
					{/*
					  A real <h3>, not CardTitle. CardTitle renders a div, so plan names
					  were styled text in a card row with no heading structure - and its
					  `font-light tracking-wide` defaults are utilities against a rung in
					  @layer components, so they won: every plan name rendered at weight
					  300 and +0.025em while every other h3 on the site sat at 500 and
					  -0.02em.
					*/}
					<h3 className="text-h3 font-heading">{name}</h3>
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
						{/*
						  "Recommended" rather than "Most popular": popularity is a
						  claim about other customers that nothing here measures.

						  Deliberately not brand orange. White on #fc6c18 measures
						  2.88:1, below even the 3:1 large-text floor, and the
						  accent's job is interactive state rather than decoration. The
						  card marks itself by sitting a step up the elevation ladder,
						  which is what `highlight` now does.
						*/}
						{highlighted && !isSelectMode && (
							<Badge className="bg-primary text-primary-foreground">
								Recommended
							</Badge>
						)}
					</div>
				</div>
				<CardDescription>{tagline}</CardDescription>
				<div className="pt-2">
					{isFree ? (
						<div>
							<span className="text-h2 font-heading">$0</span>
							<span className="text-muted-foreground text-body-sm ml-1">
								/month
							</span>
						</div>
					) : (
						<div>
							{displayAmountCents !== null ? (
								<div className="flex items-end gap-2">
									<span className="text-h2 font-heading">
										{formatCurrency(displayAmountCents, liveCurrency)}
									</span>
									<span className="text-muted-foreground text-body-sm mb-1">
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
									<span className="text-h2 font-heading">
										$
										{period === 'annual'
											? (staticAnnualMonthlyPrice ?? staticMonthlyPrice)
											: staticMonthlyPrice}
									</span>
									<span className="text-muted-foreground text-body-sm mb-1">
										/month
									</span>
								</div>
							)}
							{period === 'annual' && liveAnnualAmountCents !== null && (
								<p className="text-muted-foreground text-label-xs mt-1">
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
					<div
						key={key}
						className="text-body-sm flex items-center justify-between"
					>
						<span className="text-muted-foreground">{label}</span>
						<span className="font-medium">{format(limits[key])}</span>
					</div>
				))}
			</CardContent>

			{/* CTA footer - hidden in select mode for current plan; otherwise shown */}
			{!isSelectMode && (
				<CardFooter>
					{/*
					  asChild, so this renders one <a> rather than a <button> nested
					  inside one. The nested form was two tab stops for a single action
					  and left the role ambiguous; the page's own enterprise CTA already
					  had it right, so the two spellings disagreed on one route.
					*/}
					<Button
						asChild
						className="w-full"
						variant={highlighted ? 'default' : 'secondary'}
					>
						<Link
							to={
								ctaHref ??
								`/dashboard/billing/upgrade?plan=${plan}&period=${period}`
							}
						>
							{cta}
						</Link>
					</Button>
				</CardFooter>
			)}
			{isSelectMode && !isActive && isSelectable && (
				<CardFooter>
					<Button
						className="w-full"
						variant={isSelected ? 'default' : 'secondary'}
						onClick={(e) => {
							e.stopPropagation()
							onSelectPlan(plan)
						}}
					>
						{isSelected && <Check className="mr-2 h-4 w-4" />}
						{isSelected ? 'Selected' : `Select ${name}`}
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
		</BasicCard>
	)
}

// ---------------------------------------------------------------------------
// PricingCardsSection (exported)
// ---------------------------------------------------------------------------

const PERIOD_BUTTON_CLASS =
	'text-body-sm flex items-center rounded-lg px-4 py-1.5 font-medium transition-colors'

const periodStateClass = (selected: boolean) =>
	selected
		? 'bg-background text-foreground'
		: 'text-muted-foreground hover:text-foreground'

/*
  Enterprise is not a card. It has no price to show and no self-serve checkout,
  so it gets its own band below the grid on /pricing where it can say "tell us
  what you need". A `showEnterprise` prop used to switch a fourth card on; both
  call sites passed false, so every branch behind it was unreachable.
*/
const PRICING_CARD_PLANS: Plan[] = ['free', 'pro', 'business']

export interface PricingCardsSectionProps {
	period: 'monthly' | 'annual'
	onPeriodChange: (period: 'monthly' | 'annual') => void
	prices: BillingCheckoutOptions | null
	/** User's current plan - shows "Current plan" badge */
	activePlan?: Plan
	/** Plan currently selected for checkout - highlighted ring */
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
	activePlan,
	selectedPlan,
	onSelectPlan,
	selectablePlans
}: PricingCardsSectionProps) {
	return (
		<section aria-labelledby="plans-heading">
			{/*
			  Visually hidden, because the design runs the cards straight off the
			  hero on /pricing and the grid needs no title to be understood by
			  sight. It still needs one in the outline: without it both routes that
			  render this component went h1 straight to the h3 plan names.
			*/}
			<h2 id="plans-heading" className="sr-only">
				Plans
			</h2>
			{/*
			  aria-pressed carries the selection, because the fill alone cannot: a
			  screen-reader user got two identically-named buttons and no way to tell
			  which period the prices below belonged to.

			  The track is a sunken well and the selected control sits at page level
			  on top of it, so selection is a step on the ladder rather than a shadow
			  on a page surface. Radii match: the control is one step tighter than the
			  track it insets into.
			*/}
			<div className="mb-8 flex justify-center">
				<div
					role="group"
					aria-label="Billing period"
					className="ds-sunken flex items-center gap-1 rounded-xl p-1"
				>
					<button
						type="button"
						aria-pressed={period === 'monthly'}
						onClick={() => onPeriodChange('monthly')}
						className={cn(
							PERIOD_BUTTON_CLASS,
							periodStateClass(period === 'monthly')
						)}
					>
						Monthly
					</button>
					<button
						type="button"
						aria-pressed={period === 'annual'}
						onClick={() => onPeriodChange('annual')}
						className={cn(
							PERIOD_BUTTON_CLASS,
							'gap-1.5',
							periodStateClass(period === 'annual')
						)}
					>
						Annual
						<Badge variant="secondary" className="text-label-xs">
							{ANNUAL_DISCOUNT_CLAIM}
						</Badge>
					</button>
				</div>
			</div>

			{/*
			  Three across at md, not at sm. At 640px three columns leave 139px of
			  content inside each card, and the price row needs about 174px - so
			  the annual discount badge was clipped by the card's own
			  overflow-hidden and the limit rows ran their label into their value.
			  The four-column branch this replaced could not be reached.
			*/}
			<div className="grid gap-6 md:grid-cols-3">
				{PRICING_CARD_PLANS.map((plan) => (
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
