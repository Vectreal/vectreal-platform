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
import { useFetcher } from 'react-router'
import { Link } from 'react-router'

import { DASHBOARD_ROUTES } from '../../../constants/dashboard'
import { PLAN_DISPLAY_NAMES } from '../../../constants/product-copy'
import { InlineNotice } from '../../layout-components/inline-notice'

import type { BillingState } from '../../../constants/plan-config'
import type { BillingSettingsData } from '../../../lib/domain/dashboard/dashboard-types'

const BILLING_STATE_CONFIG: Record<
	BillingState,
	{
		label: string
		variant: 'default' | 'secondary' | 'destructive' | 'outline'
		icon: typeof CheckCircle2
		description: string
	}
> = {
	none: {
		label: 'No billing',
		variant: 'secondary',
		icon: HelpCircle,
		description: 'No active subscription.'
	},
	trialing: {
		label: 'Trial',
		variant: 'default',
		icon: Zap,
		description: 'Your free trial is active.'
	},
	active: {
		label: 'Active',
		variant: 'default',
		icon: CheckCircle2,
		description: 'Your subscription is active and in good standing.'
	},
	past_due: {
		label: 'Past due',
		variant: 'destructive',
		icon: AlertTriangle,
		description:
			'Payment failed. Please update your payment method within 7 days - after that, your account will be locked to read-only.'
	},
	unpaid: {
		label: 'Unpaid',
		variant: 'destructive',
		icon: AlertTriangle,
		description:
			'Account is read-only due to unpaid invoices. Update your payment method to continue.'
	},
	canceled: {
		label: 'Canceled',
		variant: 'destructive',
		icon: AlertTriangle,
		description:
			'Subscription canceled. Access has reverted to the Free tier. Scenes and assets exceeding Free limits will be retained for 90 days before deletion.'
	},
	paused: {
		label: 'Paused',
		variant: 'secondary',
		icon: AlertTriangle,
		description: 'Subscription is paused. Account is read-only.'
	},
	incomplete: {
		label: 'Incomplete',
		variant: 'destructive',
		icon: AlertTriangle,
		description:
			'Checkout was not completed. Access has reverted to the Free tier.'
	},
	incomplete_expired: {
		label: 'Expired',
		variant: 'destructive',
		icon: AlertTriangle,
		description: 'Checkout expired. Access has reverted to the Free tier.'
	}
}

const WARNING_STATES = new Set<BillingState>([
	'past_due',
	'unpaid',
	'canceled',
	'incomplete',
	'incomplete_expired',
	'paused'
])

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BillingSettingsSectionProps {
	billing: BillingSettingsData
}

export function BillingSettingsSection({
	billing
}: BillingSettingsSectionProps) {
	const { plan, billingState, currentPeriodEnd, trialEnd } = billing
	const portalFetcher = useFetcher()

	const stateConfig = BILLING_STATE_CONFIG[billingState]
	const StateIcon = stateConfig.icon
	const planLabel = PLAN_DISPLAY_NAMES[plan]
	const isPaid = plan !== 'free'
	const isEnterprise = plan === 'enterprise'
	const showWarning = WARNING_STATES.has(billingState)
	// Point upgrade CTA at the next logical plan so the user isn't pre-selecting
	// their current plan on arrival.
	const upgradeToPlan = plan === 'pro' ? 'business' : 'pro'
	const checkoutPath = `/dashboard/billing/upgrade?plan=${upgradeToPlan}`

	const renewalDate =
		billingState === 'trialing' && trialEnd
			? new Date(trialEnd)
			: currentPeriodEnd
				? new Date(currentPeriodEnd)
				: null

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
		<div className="space-y-4">
			{/*
			  Panels, not rules.

			  The page was one flat column with `Separator` lines between its
			  sections, which is the bordered-box pattern the surface ladder
			  replaces: each section is now a raised panel that separates from the
			  page by value, the same as every other dashboard surface.
			*/}
			<section className="ds-raised space-y-4 rounded-2xl p-5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0 space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="text-h3">{planLabel}</h2>
							<Badge
								variant={stateConfig.variant}
								className="flex items-center gap-1"
							>
								<StateIcon className="size-3" />
								{stateConfig.label}
							</Badge>
						</div>
						{/*
						  One renewal line, not two. It used to be written twice - once
						  `hidden sm:inline` and once `sm:hidden` - so the same sentence
						  had to be kept in sync in two places to change a word.
						*/}
						{renewalDate ? (
							<p className="text-muted-foreground text-sm tabular-nums">
								{billingState === 'trialing' ? 'Trial ends' : 'Renews'}{' '}
								{renewalDate.toLocaleDateString(undefined, {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							</p>
						) : null}
					</div>

					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{isPaid && !isEnterprise && (
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
								<Link to={checkoutPath}>
									<ArrowUpRight className="size-3.5" />
									{isPaid ? 'View plans' : 'Upgrade'}
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

				{showWarning ? (
					<InlineNotice
						tone="error"
						className="flex items-start gap-2.5 leading-relaxed"
					>
						<AlertTriangle className="mt-px size-3.5 shrink-0" />
						<span>{stateConfig.description}</span>
					</InlineNotice>
				) : null}
			</section>

			{/*
			  Usage is not here any more. Five readings answering "how much am I
			  using" sat on the page that answers "what am I paying", and four of
			  them again on the page for getting back to work. They have their own
			  route now, and this is the door to it.
			*/}
			<div className="px-1">
				<Button variant="ghost" size="sm" asChild>
					<Link to={DASHBOARD_ROUTES.USAGE}>View usage</Link>
				</Button>
			</div>

			<div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
				<nav className="text-muted-foreground flex items-center gap-1.5 text-xs">
					<a
						href="https://discord.gg/vectreal"
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

				{/*
				  Offered to anyone who can move up, not only to free users. A Pro
				  account has a Business plan above it, and this link was the only
				  route to the comparison table for someone who already pays.
				*/}
				{!isEnterprise && (
					<Link
						to={DASHBOARD_ROUTES.BILLING_UPGRADE}
						className="text-muted-foreground hover:text-foreground text-xs"
					>
						Compare plans
					</Link>
				)}
			</div>
		</div>
	)
}
