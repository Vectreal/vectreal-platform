import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	AlertTriangle,
	ArrowUpRight,
	CheckCircle2,
	ExternalLink,
	HelpCircle,
	Zap
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, useFetcher } from 'react-router'

import { DASHBOARD_ROUTES } from '../../../constants/dashboard'
import {
	getPurchasableUpgrade,
	type BillingState
} from '../../../constants/plan-config'
import { PLAN_DISPLAY_NAMES } from '../../../constants/product-copy'
import { describeBillingSituation } from '../../../lib/domain/billing/billing-situation'
import { InlineNotice } from '../../layout-components/inline-notice'

import type { PlanFit } from '../../../lib/domain/billing/plan-fit'
import type { BillingSettingsData } from '../../../lib/domain/dashboard/dashboard-types'

/**
 * The badge beside the plan name: what state, drawn how.
 *
 * The sentence each state used to carry is gone from here. It now lives in
 * `billing-situation.ts` with the rest of what the page says, because the
 * header and this panel were describing one situation from two places - and the
 * `canceled` entry was where a 90-day retention promise nothing enforces had
 * been sitting.
 */
const BILLING_STATE_BADGE: Record<
	BillingState,
	{
		label: string
		variant: 'default' | 'secondary' | 'destructive' | 'outline'
		icon: typeof CheckCircle2
	}
> = {
	none: { label: 'No billing', variant: 'secondary', icon: HelpCircle },
	trialing: { label: 'Trial', variant: 'default', icon: Zap },
	active: { label: 'Active', variant: 'default', icon: CheckCircle2 },
	past_due: { label: 'Past due', variant: 'destructive', icon: AlertTriangle },
	unpaid: { label: 'Unpaid', variant: 'destructive', icon: AlertTriangle },
	canceled: { label: 'Canceled', variant: 'secondary', icon: AlertTriangle },
	paused: { label: 'Paused', variant: 'secondary', icon: AlertTriangle },
	incomplete: {
		label: 'Incomplete',
		variant: 'secondary',
		icon: AlertTriangle
	},
	incomplete_expired: {
		label: 'Expired',
		variant: 'secondary',
		icon: AlertTriangle
	}
}

interface BillingSettingsSectionProps {
	billing: BillingSettingsData
	planFit: PlanFit
}

export function BillingSettingsSection({
	billing,
	planFit
}: BillingSettingsSectionProps) {
	const { billingState, hasBillingAccount } = billing
	const portalFetcher = useFetcher()

	const situation = describeBillingSituation(billing)
	const badge = BILLING_STATE_BADGE[billingState]
	const BadgeIcon = badge.icon

	/*
	  The plan named here is the effective one, never the stored one.

	  A canceled or incomplete subscription keeps its paid plan in the row while
	  access has reverted to Free, so `plan` said `Pro` for an organization
	  holding nothing of the sort - and, with the header stating the situation,
	  printed `Pro` directly above "your Pro subscription was canceled".

	  It governs what the plan button offers, so a canceled organization is
	  offered the upgrade a free one is. It deliberately does **not** govern the
	  portal, which belongs to whether Stripe knows this customer.
	*/
	const effectivePlan = situation.effectivePlan
	const planLabel = PLAN_DISPLAY_NAMES[effectivePlan]
	const isPaid = effectivePlan !== 'free'
	/*
	  Enterprise turns on the effective plan too, so an enterprise organization
	  whose subscription ended is offered the ordinary upgrade rather than the
	  account-team link. That is what its access is, and the account team is
	  reachable from `/contact` either way.
	*/
	const isEnterprise = effectivePlan === 'enterprise'

	const nextPlanUp = getPurchasableUpgrade(effectivePlan)
	const changePlanPath = nextPlanUp
		? `${DASHBOARD_ROUTES.BILLING_UPGRADE}?plan=${nextPlanUp}`
		: DASHBOARD_ROUTES.BILLING_UPGRADE

	const handleOpenPortal = () => {
		portalFetcher.submit({}, { method: 'POST', action: '/api/billing/portal' })
	}

	type PortalFetcherResponse = {
		data: {
			portalUrl: string
		}
	}

	const hasPortalUrl = (value: unknown): value is PortalFetcherResponse => {
		if (!value || typeof value !== 'object' || !('data' in value)) {
			return false
		}

		const { data } = value as { data: unknown }

		if (!data || typeof data !== 'object' || !('portalUrl' in data)) {
			return false
		}

		return typeof (data as { portalUrl: unknown }).portalUrl === 'string'
	}

	useEffect(() => {
		if (portalFetcher.state !== 'idle' || !hasPortalUrl(portalFetcher.data)) {
			return
		}

		window.location.href = portalFetcher.data.data.portalUrl
	}, [portalFetcher.state, portalFetcher.data])

	return (
		/*
		  `space-y-8` because these are two blocks of a page, and 32px is the step
		  every other dashboard route puts between them - `usage` measures exactly
		  that between its panel and the link below it. At `space-y-4` the doors
		  row sat against the bottom of the panel and read as part of it. The
		  route body carries the same step for the same reason, where it governs
		  any second section added later.
		*/
		<div className="space-y-8">
			{/*
			  Panels, not rules.

			  The page was one flat column with `Separator` lines between its
			  sections, which is the bordered-box pattern the surface ladder
			  replaces: each section separates from the page by value, the same as
			  every other dashboard surface.
			*/}
			<section className="ds-raised space-y-4 rounded-2xl p-5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<h2 className="text-h3">{planLabel}</h2>
						{/*
						  No badge on `none`. It read "No billing" beside a header
						  already saying "Nothing is being charged", which is one fact
						  twice - and it was the only thing on the panel for the free
						  organizations that are every account in production.

						  The renewal date is gone from here for the same reason: the
						  header states it, and it was the panel's second line.
						*/}
						{billingState !== 'none' && (
							<Badge
								variant={badge.variant}
								className="flex items-center gap-1"
							>
								<BadgeIcon className="size-3" />
								{badge.label}
							</Badge>
						)}
					</div>

					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{/*
						  Shown for a Stripe customer, not for a paid plan.

						  A canceled organization keeps its customer, and its invoice
						  history is the thing someone most often comes back for; gating
						  this on the plan hid that door the moment the subscription
						  ended.

						  This covers one of the two things `/api/billing/portal` asks
						  for. It also requires the owner or admin role and answers 403
						  otherwise, and the loader ships no role, so a member still sees
						  a button that does nothing - the fetcher has no branch for the
						  failure either. Both predate this change and are filed together:
						  closing it means a role on the loader, which is its own concern.
						*/}
						{hasBillingAccount && !isEnterprise && (
							<Button
								variant="secondary"
								size="sm"
								onClick={handleOpenPortal}
								disabled={portalFetcher.state !== 'idle'}
							>
								<ExternalLink className="size-3.5" />
								{portalFetcher.state !== 'idle' ? 'Opening…' : 'Manage billing'}
							</Button>
						)}
						{!isEnterprise && (
							<Button size="sm" variant={isPaid ? 'ghost' : 'default'} asChild>
								<Link to={changePlanPath}>
									<ArrowUpRight className="size-3.5" />
									{/*
									  Names the destination once the page has given a reason
									  to go there. "Upgrade" is a category; "Upgrade to Pro"
									  is the thing the rows above just described.
									*/}
									{planFit.nextPlanLabel
										? `${isPaid ? 'Move to' : 'Upgrade to'} ${planFit.nextPlanLabel}`
										: 'View plans'}
								</Link>
							</Button>
						)}
						{isEnterprise && (
							<Button variant="secondary" size="sm" asChild>
								<Link to="/contact">Contact account team</Link>
							</Button>
						)}
					</div>
				</div>

				{/*
				  Whether this plan still fits, in the reader's own numbers.

				  The page's question is "am I on the right plan", and a plan name
				  with a button answers it for nobody. Only readings actually under
				  pressure appear, so an organization with room gets one sentence
				  saying so rather than a five-row comparison grid it has to read to
				  learn that nothing is wrong.
				*/}
				{planFit.headline ? (
					<p className="text-muted-foreground text-sm">{planFit.headline}</p>
				) : null}

				{planFit.rows.length > 0 ? (
					<dl className="space-y-2">
						{planFit.rows.map((row) => (
							<div
								key={row.key}
								className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"
							>
								<dt className="text-muted-foreground">{row.label}</dt>
								<dd className="flex items-baseline gap-2 tabular-nums">
									<span className={row.atLimit ? 'font-medium' : undefined}>
										{row.usedLabel} of {row.limitLabel}
									</span>
									{/*
									  The next plan's number sits beside the current one rather
									  than in a column of its own: one row, read left to right,
									  is the whole comparison a reader needs to make.
									*/}
									{row.nextLimitLabel ? (
										<span className="text-muted-foreground">
											&rarr; {row.nextLimitLabel} on {planFit.nextPlanLabel}
										</span>
									) : null}
								</dd>
							</div>
						))}
					</dl>
				) : null}

				{/*
				  Say what is behind the button.

				  The four things a billing page is normally asked for - the amount,
				  the payment method, the invoices, and how to cancel - are none of
				  them here, and all four are in Stripe's portal. A reader had to
				  guess that from the words "Manage billing", so this page appeared
				  to have lost them rather than to have handed them over.

				  Only where there is a portal to open: a free organization has no
				  Stripe customer, and telling it where its invoices are would invent
				  a relationship it does not have.
				*/}
				{hasBillingAccount && !isEnterprise ? (
					<p className="text-muted-foreground text-sm">
						Invoices, payment method and cancellation live in the Stripe portal.
					</p>
				) : null}

				{/*
				  One notice, for whatever the situation has to add. It used to fire
				  on a hand-written set of six states and always in red, which drew
				  an alarm for a cancellation the reader had just chosen.
				*/}
				{situation.remedy ? (
					<InlineNotice
						tone={situation.isProblem ? 'error' : 'neutral'}
						className="flex items-start gap-2.5 leading-relaxed"
					>
						{situation.isProblem ? (
							<AlertTriangle className="mt-px size-3.5 shrink-0" />
						) : null}
						<span>{situation.remedy}</span>
					</InlineNotice>
				) : null}
			</section>

			{/*
			  The page's quiet doors, on one line.

			  These were three separate rows at three different weights: a ghost
			  button for usage, a link row for support, and a "Compare plans" link
			  that went to the same route as the button above. On a phone they
			  stacked into four link-shaped things with no hierarchy between them.

			  Usage is not here any more either - five readings answering "how much
			  am I using" sat on the page that answers "what am I paying". This is
			  the door to it.
			*/}
			<div className="text-muted-foreground flex flex-col gap-2 px-1 text-xs sm:flex-row sm:items-center sm:justify-between">
				<Link
					to={DASHBOARD_ROUTES.USAGE}
					className="hover:text-foreground w-fit transition-colors"
				>
					View usage
				</Link>

				<nav className="flex items-center gap-1.5">
					{/*
					  The canonical invite. This was the one place in the repo reaching
					  `discord.gg/vectreal` against eleven uses of the real code, and a
					  vanity invite needs a boosted server to resolve at all - so the
					  support link on the billing page was the one most likely to be
					  dead.
					*/}
					<a
						href="https://discord.gg/A9a3nPkZw7"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-foreground transition-colors"
					>
						Discord
					</a>
					<span className="text-muted-foreground/40">·</span>
					<Link to="/docs" className="hover:text-foreground transition-colors">
						Docs
					</Link>
					<span className="text-muted-foreground/40">·</span>
					<Link
						to="/contact"
						className="hover:text-foreground transition-colors"
					>
						Support
					</Link>
				</nav>
			</div>
		</div>
	)
}
