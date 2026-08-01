import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
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
import {
	PLAN_DISPLAY_NAMES,
	STORAGE_USAGE_HINT,
	STORAGE_USAGE_LABEL
} from '../../../constants/product-copy'
import { UsageMeter } from '../usage-meter'

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
	const { plan, billingState, currentPeriodEnd, trialEnd, usage } = billing
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
		<div className="space-y-8">
			{/* ── Plan header strip ─────────────────────────────── */}
			<div className="space-y-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<h2 className="text-lg font-semibold tracking-tight">
							{planLabel}
						</h2>
						<Badge
							variant={stateConfig.variant}
							className="flex items-center gap-1"
						>
							<StateIcon className="h-3 w-3" />
							{stateConfig.label}
						</Badge>
						{renewalDate && (
							<span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
								{billingState === 'trialing' ? 'Trial ends' : 'Renews'}{' '}
								{renewalDate.toLocaleDateString(undefined, {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						{isPaid && !isEnterprise && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleOpenPortal}
								disabled={portalFetcher.state !== 'idle'}
							>
								<ExternalLink className="mr-1.5 h-3 w-3" />
								{portalFetcher.state !== 'idle' ? 'Opening…' : 'Manage billing'}
							</Button>
						)}
						{!isEnterprise && (
							<Link to={checkoutPath}>
								<Button size="sm" variant={isPaid ? 'ghost' : 'default'}>
									<ArrowUpRight className="mr-1.5 h-3 w-3" />
									{isPaid ? 'View plans' : 'Upgrade'}
								</Button>
							</Link>
						)}
						{isEnterprise && (
							<Link to="/contact">
								<Button variant="outline" size="sm">
									Contact account team
								</Button>
							</Link>
						)}
					</div>
				</div>

				{/* Mobile renewal date */}
				{renewalDate && (
					<p className="text-muted-foreground text-xs tabular-nums sm:hidden">
						{billingState === 'trialing' ? 'Trial ends' : 'Renews'}{' '}
						{renewalDate.toLocaleDateString(undefined, {
							month: 'short',
							day: 'numeric',
							year: 'numeric'
						})}
					</p>
				)}

				{/* Warning alert bar */}
				{showWarning && (
					<div className="bg-destructive/5 border-destructive/20 flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
						<AlertTriangle className="text-destructive mt-0.5 h-3.5 w-3.5 shrink-0" />
						<p className="text-destructive text-xs leading-relaxed">
							{stateConfig.description}
						</p>
					</div>
				)}
			</div>

			{/* ── KPI stat grid ─────────────────────────────────── */}
			<section className="grid grid-cols-2 gap-3 md:grid-cols-3">
				<UsageMeter
					label="Scenes"
					current={usage.scenesTotal}
					limit={usage.sceneLimit}
				/>
				<UsageMeter
					label="Projects"
					current={usage.projectsTotal}
					limit={usage.projectsLimit}
				/>
				<UsageMeter
					label="Published"
					current={usage.publishedScenes}
					limit={usage.publishedSceneLimit}
				/>
			</section>

			<Separator />

			{/* ── Detailed usage meters ────────────────────────── */}
			<section className="grid gap-8 md:grid-cols-2">
				<div className="space-y-4">
					<p className="text-muted-foreground text-eyebrow">
						Content
					</p>
					<div className="space-y-3">
						<UsageMeter
							variant="row"
							label="Scenes (total)"
							current={usage.scenesTotal}
							limit={usage.sceneLimit}
						/>
						<UsageMeter
							variant="row"
							label="Published scenes"
							current={usage.publishedScenes}
							limit={usage.publishedSceneLimit}
						/>
						<UsageMeter
							variant="row"
							label="Projects"
							current={usage.projectsTotal}
							limit={usage.projectsLimit}
						/>
					</div>
				</div>
				<div className="space-y-4">
					<p className="text-muted-foreground text-eyebrow">
						API &amp; processing
					</p>
					<div className="space-y-3">
						<UsageMeter
							variant="row"
							label="API requests"
							current={usage.apiRequestsMonth}
							limit={usage.apiRequestsMonthLimit}
							monthly
						/>
					</div>
				</div>
				<div className="space-y-4">
					<p className="text-muted-foreground text-eyebrow">
						Storage &amp; bandwidth
					</p>
					<div className="space-y-3">
						<UsageMeter
							variant="row"
							label={`${STORAGE_USAGE_LABEL} (MB)`}
							hint={STORAGE_USAGE_HINT}
							current={Math.round(usage.storageBytesTotal / (1024 * 1024))}
							limit={
								usage.storageLimit !== null
									? Math.round(usage.storageLimit / (1024 * 1024))
									: null
							}
						/>
						<UsageMeter
							variant="row"
							label="Embed bandwidth (GB)"
							current={usage.embedBandwidthMonth}
							limit={usage.embedBandwidthLimit}
							monthly
						/>
						<UsageMeter
							variant="row"
							label="Preview loads"
							current={usage.previewLoadsMonth}
							limit={usage.previewLoadsMonthLimit}
							monthly
						/>
					</div>
				</div>
			</section>

			<Separator />

			{/* ── Footer: quick links + upgrade hint ───────────── */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

				{!isPaid && (
					<p className="text-muted-foreground text-xs">
						Need more?{' '}
						<Link
							to={DASHBOARD_ROUTES.BILLING_UPGRADE}
							className="text-foreground underline-offset-4 hover:underline"
						>
							Compare plans
						</Link>
					</p>
				)}
			</div>
		</div>
	)
}
