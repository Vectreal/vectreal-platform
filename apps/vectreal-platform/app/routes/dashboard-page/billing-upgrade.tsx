import { useFeatureFlagEnabled, usePostHog } from '@posthog/react'
import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { cn } from '@shared/utils'
import { Loader2, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
	data,
	Link,
	useFetcher,
	useLoaderData,
	useSearchParams
} from 'react-router'

import { Route } from './+types/billing-upgrade'
import { InlineNotice } from '../../components/layout-components/inline-notice'
import {
	PAYMENT_TRUST_COPY,
	PLAN_DISPLAY_NAMES
} from '../../constants/product-copy'
import { countLiveApiKeys } from '../../lib/domain/auth/api-key-repository.server'
import {
	getCheckoutOptions,
	loadBillingDashboardData,
	loadOrgUsage
} from '../../lib/domain/billing/billing-dashboard-loader.server'
import { describeBillingSituation } from '../../lib/domain/billing/billing-situation'
import { resolveCheckoutGate } from '../../lib/domain/billing/checkout-kill-switch'
import {
	comparePlans,
	getPlanChangeTargets,
	resolveInitialTarget
} from '../../lib/domain/billing/plan-comparison'
import { usageByLimit } from '../../lib/domain/billing/plan-fit'
import {
	describeAnnualSaving,
	resolvePlanPrice,
	type BillingPeriod
} from '../../lib/domain/billing/plan-price'
import { countOrganizationMembers } from '../../lib/domain/organization/organization-repository.server'

import type { Plan } from '../../constants/plan-config'
import type { BillingCheckoutOptions } from '../../lib/domain/dashboard/dashboard-types'
import type { PostHogContext } from '../../lib/posthog/posthog-middleware'

export async function loader({ request, context }: Route.LoaderArgs) {
	const checkoutOptionsPromise = getCheckoutOptions().catch(
		(): BillingCheckoutOptions => ({
			pro: { monthly: null, annual: null },
			business: { monthly: null, annual: null }
		})
	)

	const { loaderData, actorId, organizationId, headers } =
		await loadBillingDashboardData(request, {
			includeCheckoutOptions: false
		})

	/*
	  The same rule the action enforces, from the same module. This used to
	  decide separately and fail open twice over - `.catch(() => true)` on an
	  unreachable PostHog, and `true` outright when it was not configured - so
	  the page offered a button the action would now refuse.
	*/
	const checkoutGatePromise = resolveCheckoutGate(
		(context as PostHogContext).posthog,
		actorId
	)

	const [checkoutOptions, checkoutGate, usage, apiKeys, seats] =
		await Promise.all([
			checkoutOptionsPromise,
			checkoutGatePromise,
			loadOrgUsage(organizationId),
			/*
			  The two limits the usage record does not count. They are the same
			  measures the guards refusing a new key or a new member read, so the
			  figure here is the figure that refused the reader.
			*/
			countLiveApiKeys(organizationId),
			countOrganizationMembers(organizationId)
		])

	/*
	  Compared from the plan actually held. A canceled Pro organization is on
	  Free, and choosing Pro again is an upgrade from Free, not a move to the
	  plan it already has.
	*/
	const { effectivePlan } = describeBillingSituation(loaderData.billing)

	return data(
		{
			...loaderData,
			effectivePlan,
			used: {
				...usageByLimit(usage),
				api_keys_per_org: apiKeys,
				org_seats: seats
			},
			checkoutOptions,
			checkoutEnabled: checkoutGate.allowed
		},
		{ headers }
	)
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

type CheckoutFetcherResponse = { data: { redirectUrl: string } }

function hasCheckoutUrl(value: unknown): value is CheckoutFetcherResponse {
	if (!value || typeof value !== 'object' || !('data' in value)) return false
	const { data } = value as { data: unknown }
	if (!data || typeof data !== 'object' || !('redirectUrl' in data)) {
		return false
	}
	return typeof (data as { redirectUrl: unknown }).redirectUrl === 'string'
}

/**
 * Deciding whether to change plan, and changing it.
 *
 * This was the public pricing page, mounted inside the dashboard: four plan
 * cards, two of which could not be chosen, a seventeen-row entitlement table,
 * and a checkout bar pinned over the table it sat below. The reader is not an
 * anonymous visitor comparing four plans. They hold one, most often arrived
 * from a refusal, and are choosing between it and the one above - so the page
 * now states what that change would do for them and lets them make it.
 *
 * What went with the old layout, all measured on this route. (The classes are
 * described rather than spelled: Tailwind scans these comments, and naming a
 * utility here keeps it compiled into the bundle.)
 *
 * - **Its own scroll container.** A capped height with its own overflow, inside
 *   the dashboard's scroller and 1044px tall in a 992px parent, so a phone
 *   showed two scrollbars and scrolled the wrong one.
 * - **A bar that covered the content.** Stuck to the top and placed after the
 *   cards, it pinned itself over the comparison, carried a large shadow on a
 *   page surface - which `elevation.md` reserves for portalled overlays - and
 *   reserved a block of dead space below to let it travel.
 * - **Its own measure.** A centred max width and a gutter inside
 *   `.container-page`, which already sets both, so the gutter applied twice.
 * - **Two prices for one selection** - see `plan-price.ts`.
 * - **A dead button.** Checkout is shut, and the page still led with a
 *   disabled "Continue to payment" under a notice saying to "try again later",
 *   which promised a date nothing holds.
 */
function BillingUpgradeContent() {
	const {
		billing,
		effectivePlan,
		used,
		checkoutOptions,
		checkoutEnabled: serverCheckoutEnabled
	} = useLoaderData<typeof loader>()
	const [searchParams] = useSearchParams()
	const checkoutFetcher = useFetcher()
	const posthog = usePostHog()

	/*
	  The client may close this, never open it.

	  It used to be the authority whenever it had an opinion, so a client that
	  said yes overrode a server that had said no - and the two evaluate against
	  different inputs often enough for that to happen: the browser token is a
	  Docker build arg while the server's is a Fly secret, and the client
	  evaluates anonymously until analytics consent lets it `identify`. The
	  action denies either way, so this only decides whether the reader is
	  offered a button that cannot work.
	*/
	const clientFlagEnabled = useFeatureFlagEnabled('billing-checkout')
	const checkoutEnabled = serverCheckoutEnabled && (clientFlagEnabled ?? true)

	const targets = getPlanChangeTargets(effectivePlan)
	const [target, setTarget] = useState<Plan | null>(() =>
		resolveInitialTarget(effectivePlan, searchParams.get('plan'))
	)
	const [period, setPeriod] = useState<BillingPeriod>(
		searchParams.get('period') === 'annual' ? 'annual' : 'monthly'
	)
	const [confirmOpen, setConfirmOpen] = useState(false)

	const paidTarget = target === 'pro' || target === 'business' ? target : null
	const comparison = target
		? comparePlans(effectivePlan, target, { used })
		: null
	const price = paidTarget
		? resolvePlanPrice(paidTarget, period, checkoutOptions)
		: null
	const annualSaving = paidTarget
		? describeAnnualSaving(paidTarget, checkoutOptions)
		: null

	/*
	  Buyable needs both halves: the switch open, and a live Stripe price to
	  submit. A fallback price is shown and never sent.
	*/
	const canBuy = checkoutEnabled && price?.priceId != null

	// Whether this selection will skip Stripe's hosted checkout and update the
	// subscription in place - mirrors the server-side route decision.
	const isDirectUpdate = billing.billingState === 'active'

	useEffect(() => {
		posthog?.capture('billing_upgrade_viewed', { plan: billing.plan })
	}, [posthog, billing.plan])

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

	useEffect(() => {
		if (checkoutError) setConfirmOpen(false)
	}, [checkoutError])

	const submitCheckout = () => {
		if (!paidTarget || !price?.priceId) return
		setConfirmOpen(false)
		posthog?.capture('plan_upgrade_started', {
			from_plan: billing.plan,
			to_plan: paidTarget,
			billing_period: period,
			trigger: searchParams.get('trigger') ?? 'settings'
		})
		checkoutFetcher.submit(
			JSON.stringify({
				planId: paidTarget,
				priceId: price.priceId,
				billingPeriod: period
			}),
			{
				method: 'POST',
				action: '/api/billing/checkout',
				encType: 'application/json'
			}
		)
	}

	const isSubmitting = checkoutFetcher.state !== 'idle'
	const targetLabel = target ? PLAN_DISPLAY_NAMES[target] : null

	return (
		/*
		  Two columns where there is room, and one clear order where there is not.

		  The reader arrived with a question - usually "why can I not do this" -
		  and leaves with a decision, so those are the two regions: the reason and
		  what the change does on the left, the decision on the right in a panel the
		  width of the scene page's aside. Every one of these used to share one
		  panel at one size, so the sentence saying why the reader was here was a
		  grey caption and the price was a line among lines.

		  Placed by grid rather than by DOM order, so a phone reads reason, then
		  price and action, then the detail - the decision is not below a list of
		  seven rows on a small screen.

		  The statement runs across both columns and the table and the panel sit
		  under it as peers, top-aligned. With the panel spanning up beside the
		  statement it started early and ended early, and the table hung below it
		  alone - the lower half of a wide screen was the table and nothing.

		  Two columns of the panel width, sitting together at the left of the page
		  like every other dashboard route. A `1fr` column pinned the panel to the
		  far edge; the reading measure still left a three-column table 400px
		  between a label and its values. At the panel's width the table is as
		  wide as its content and reads as one unit with the decision beside it.
		*/
		<div className="grid gap-8 py-6 lg:grid-cols-[minmax(0,var(--container-detail-panel))_var(--container-detail-panel)] lg:items-start lg:gap-x-16">
			{/*
			  One statement. It had an eyebrow naming the change, the statement, a
			  sentence restating the first table row, and a "What changes" heading
			  over a table already headed with both plan names - four layers of
			  heading before a number.
			*/}
			<header className="space-y-2 lg:col-span-2">
				<h2 className="text-h3 text-balance">
					{comparison
						? comparison.title
						: effectivePlan === 'enterprise'
							? 'Your plan is arranged with the account team.'
							: 'Business is the largest plan you can buy here.'}
				</h2>
				{comparison?.detail ? (
					<p className="text-muted-foreground text-body text-pretty">
						{comparison.detail}
					</p>
				) : !comparison && effectivePlan !== 'enterprise' ? (
					<p className="text-muted-foreground text-body">
						Enterprise is arranged with our team.
					</p>
				) : null}
			</header>

			{/*
			  The decision: the plan, what it costs, and the action.

			  One control, for the one real choice. The billing period is not a
			  second choice of equal weight - most people pay monthly, and yearly is
			  an offer - so it is a single line that makes the offer with its saving,
			  and one quiet line back. Two identical switches stacked around the
			  price made the number read as a banner between controls; a list of
			  radio rows made a checkout form out of a decision.
			*/}
			<aside
				aria-label="Your decision"
				className="ds-raised space-y-5 rounded-2xl p-5 lg:col-start-2 lg:row-start-2"
			>
				{targets.length > 1 || target === null ? (
					<ToggleGroup
						type="single"
						value={target ?? ''}
						onValueChange={(value) => {
							// Radix clears the value when the active item is pressed again.
							if (value) setTarget(value as Plan)
						}}
						className="ds-sunken h-10 w-full rounded-xl p-1"
						aria-label="Plan"
					>
						{targets.map((plan) => (
							<ToggleGroupItem
								key={plan}
								value={plan}
								className="h-8 rounded-lg first:rounded-l-lg last:rounded-r-lg"
							>
								{PLAN_DISPLAY_NAMES[plan]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				) : null}

				{paidTarget && price && targetLabel ? (
					<>
						<div className="space-y-1">
							{/* Named only when no switch above already names it. */}
							{targets.length > 1 ? null : (
								<p className="text-h4">{targetLabel}</p>
							)}
							<p className="tabular-nums">
								<span className="text-stat">{price.perMonthLabel}</span>
								<span className="text-muted-foreground text-sm">
									{' '}
									per month
								</span>
							</p>
							{price.billedLabel ? (
								<p className="text-muted-foreground text-xs tabular-nums">
									{price.billedLabel} &middot;{' '}
									<button
										type="button"
										onClick={() => setPeriod('monthly')}
										className="hover:text-foreground underline underline-offset-4"
									>
										Pay monthly
									</button>
								</p>
							) : null}
						</div>

						{/*
						  The offer, while paying monthly. One click to take it, and the
						  saving is the part that is emphasized because it is the reason
						  to click. Once taken, the way back is the quiet link under the
						  price rather than a second offer.
						*/}
						{period === 'monthly' && annualSaving ? (
							<button
								type="button"
								onClick={() => setPeriod('annual')}
								className="ds-overlay-interactive flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm"
							>
								<span>Pay yearly</span>
								<span className="bg-success/25 text-success-foreground rounded-full px-2 py-0.5 text-xs font-medium">
									Save {annualSaving} a year
								</span>
							</button>
						) : null}

						{checkoutError ? (
							<InlineNotice tone="error" className="text-sm">
								{checkoutError}
							</InlineNotice>
						) : null}

						{canBuy ? (
							<div className="space-y-2">
								<Button
									className="w-full"
									onClick={
										isDirectUpdate ? () => setConfirmOpen(true) : submitCheckout
									}
									disabled={isSubmitting}
								>
									{isSubmitting ? (
										<Loader2 className="size-4 animate-spin" />
									) : null}
									{isSubmitting
										? isDirectUpdate
											? 'Updating…'
											: 'Opening Stripe…'
										: isDirectUpdate
											? `Change to ${targetLabel}`
											: 'Continue to payment'}
								</Button>
								<p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
									<Lock className="size-3" />
									{PAYMENT_TRUST_COPY}
								</p>
							</div>
						) : (
							/*
							  No disabled button. It looked like the way forward and was
							  not one, under a notice promising "try again later" to a
							  switch held shut with no date. What is true in every case
							  where this renders - the switch closed, or no live Stripe
							  price to sell - is that it cannot be bought here now, and
							  the one real alternative is a person. So the panel still
							  ends on an action, and it is one that works.
							*/
							<div className="space-y-2">
								<Button variant="secondary" className="w-full" asChild>
									<Link to="/contact">Contact us</Link>
								</Button>
								<p className="text-muted-foreground text-center text-xs">
									{targetLabel} can&rsquo;t be bought here right now.
								</p>
							</div>
						)}

						{/*
						  What the reader is committing to, which is the question left
						  after the price. Each line is what the code does on that path:
						  hosted checkout redirects to Stripe and the success page syncs
						  the subscription the entitlements are read from; a direct
						  update is `stripe.subscriptions.update` with
						  `create_prorations`; the reply time is the one `/contact`
						  already publishes.
						*/}
						<ul className="text-muted-foreground space-y-1.5 text-xs">
							{canBuy && !isDirectUpdate ? (
								<>
									<li>You pay on Stripe&rsquo;s checkout page.</li>
									<li>New limits apply as soon as checkout completes.</li>
								</>
							) : canBuy ? (
								<>
									<li>Your subscription changes when you confirm.</li>
									<li>The difference is prorated onto your next invoice.</li>
								</>
							) : (
								<>
									<li>Tell us which plan you need and how you use it.</li>
									<li>We usually reply within one business day.</li>
								</>
							)}
						</ul>
					</>
				) : (
					<Button variant="secondary" className="w-full" asChild>
						<Link to="/contact">Contact us</Link>
					</Button>
				)}
			</aside>

			{comparison ? (
				/*
				  Separated by space, not rules. Every row carried a hairline, which is
				  the bordered-box pattern the surface ladder replaces; seven of them
				  was most of the page's ink.

				  What a plan adds or removes beyond its limits is a row in the same
				  table rather than a sentence trailing after it, and the reading that
				  brought the reader here is the only row not in the muted colour.
				*/
				<table className="w-full text-sm lg:col-start-1 lg:row-start-2">
					<caption className="sr-only">
						What changes from {comparison.fromLabel} to {comparison.toLabel}
					</caption>
					<thead>
						<tr className="text-muted-foreground">
							<th scope="col" className="pb-3 text-left font-normal">
								<span className="sr-only">Limit</span>
							</th>
							<th scope="col" className="pb-3 pl-6 text-right font-normal">
								{comparison.fromLabel}
							</th>
							<th
								scope="col"
								className="text-foreground pb-3 pl-6 text-right font-medium"
							>
								{comparison.toLabel}
							</th>
						</tr>
					</thead>
					<tbody>
						{comparison.rows.map((row) => (
							<tr key={row.key}>
								<th
									scope="row"
									className={cn(
										'py-1.5 text-left',
										row.isTight
											? 'text-foreground font-medium'
											: 'text-muted-foreground font-normal'
									)}
								>
									{row.label}
								</th>
								<td className="text-muted-foreground py-1.5 pl-6 text-right tabular-nums">
									{row.fromLabel}
								</td>
								<td
									className={cn(
										'py-1.5 pl-6 text-right font-medium tabular-nums',
										row.change === 'lowered' && 'text-warning-foreground'
									)}
								>
									{row.toLabel}
								</td>
							</tr>
						))}
						{comparison.gained.map((label) => (
							<tr key={label}>
								<th
									scope="row"
									className="text-muted-foreground py-1.5 text-left font-normal"
								>
									{label}
								</th>
								<td className="text-muted-foreground py-1.5 pl-6 text-right">
									&ndash;
								</td>
								<td className="py-1.5 pl-6 text-right font-medium">Included</td>
							</tr>
						))}
						{comparison.lost.map((label) => (
							<tr key={label}>
								<th
									scope="row"
									className="text-muted-foreground py-1.5 text-left font-normal"
								>
									{label}
								</th>
								<td className="text-muted-foreground py-1.5 pl-6 text-right">
									Included
								</td>
								<td className="text-warning-foreground py-1.5 pl-6 text-right font-medium">
									&ndash;
								</td>
							</tr>
						))}
					</tbody>
				</table>
			) : null}

			{/* Only shown for direct subscription updates, where there is no Stripe page in between. */}
			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Change to {targetLabel}?</DialogTitle>
						<DialogDescription>
							Your subscription changes immediately. Unused time on the current
							period is prorated onto your next invoice.
						</DialogDescription>
					</DialogHeader>

					{comparison?.isReduction ? (
						<InlineNotice tone="warning" className="text-sm">
							{comparison.title}
							{comparison.lost.length > 0
								? ` It does not include ${comparison.lost.join(', ')}.`
								: ''}
						</InlineNotice>
					) : null}

					{price ? (
						<p className="text-sm tabular-nums">
							{price.perMonthLabel} per month
							{price.billedLabel ? (
								<span className="text-muted-foreground">
									{' '}
									&middot; {price.billedLabel}
								</span>
							) : null}
						</p>
					) : null}

					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirmOpen(false)}>
							Cancel
						</Button>
						<Button onClick={submitCheckout}>Change plan</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default function BillingUpgradePage() {
	return <BillingUpgradeContent />
}
