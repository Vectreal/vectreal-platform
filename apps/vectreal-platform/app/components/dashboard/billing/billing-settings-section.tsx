import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Progress } from '@shared/components/ui/progress'
import { Separator } from '@shared/components/ui/separator'
import { cn } from '@shared/utils'
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

import type { BillingState, Plan } from '../../../constants/plan-config'
import type { BillingSettingsData } from '../../../lib/domain/dashboard/dashboard-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAN_LABELS: Record<Plan, string> = {
	free: 'Free',
	pro: 'Pro',
	business: 'Business',
	enterprise: 'Enterprise'
}

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
			'Payment failed. Please update your payment method to restore full access.'
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
		variant: 'outline',
		icon: HelpCircle,
		description: 'Subscription canceled. Access has reverted to the Free tier.'
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
	'incomplete',
	'incomplete_expired',
	'paused'
])

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatTile({
	label,
	current,
	limit,
	monthly
}: {
	label: string
	current: number
	limit: number | null
	monthly?: boolean
}) {
	const unlimited = limit === null
	const percent = unlimited
		? 0
		: Math.min(Math.round((current / limit) * 100), 100)
	const isWarning = !unlimited && percent >= 80
	const isCritical = !unlimited && percent >= 95

	return (
		<div className="bg-muted/20 space-y-3 rounded-xl p-4">
			<p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
				{label}
				{monthly && (
					<span className="text-muted-foreground/60 ml-1 tracking-normal normal-case">
						/mo
					</span>
				)}
			</p>
			<p
				className={cn(
					'text-2xl font-semibold tracking-tight tabular-nums',
					isCritical && 'text-destructive',
					isWarning && !isCritical && 'text-accent!'
				)}
			>
				{current.toLocaleString()}
				<span className="text-muted-foreground ml-0.5 text-sm font-normal">
					{!unlimited ? `/ ${limit.toLocaleString()}` : '/ ∞'}
				</span>
			</p>
			{!unlimited && (
				<Progress
					value={percent}
					className={cn(
						'h-1',
						isCritical && '[&>div]:bg-destructive',
						isWarning && !isCritical && '[&>div]:bg-accent!'
					)}
				/>
			)}
			{unlimited && <div className="bg-muted/40 h-1 rounded-full" />}
		</div>
	)
}

function MeterRow({
	label,
	current,
	limit,
	monthly
}: {
	label: string
	current: number
	limit: number | null
	monthly?: boolean
}) {
	const unlimited = limit === null
	const percent = unlimited
		? 0
		: Math.min(Math.round((current / limit) * 100), 100)
	const isWarning = !unlimited && percent >= 80
	const isCritical = !unlimited && percent >= 95

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between">
				<span className="text-muted-foreground text-xs">
					{label}
					{monthly && (
						<span className="text-muted-foreground/50 ml-1">/mo</span>
					)}
				</span>
				<span
					className={cn(
						'text-xs font-medium tabular-nums',
						isCritical && 'text-destructive',
						isWarning && !isCritical && 'text-accent!'
					)}
				>
					{current.toLocaleString()}
					{!unlimited ? ` / ${limit.toLocaleString()}` : ' / ∞'}
				</span>
			</div>
			{!unlimited && (
				<Progress
					value={percent}
					className={cn(
						'h-1',
						isCritical && '[&>div]:bg-destructive',
						isWarning && !isCritical && '[&>div]:bg-accent!'
					)}
				/>
			)}
		</div>
	)
}

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
	const planLabel = PLAN_LABELS[plan]
	const isPaid = plan !== 'free'
	const isEnterprise = plan === 'enterprise'
	const showWarning = WARNING_STATES.has(billingState)
	const checkoutPath = '/dashboard/billing/upgrade?plan=pro'

	const renewalDate =
		billingState === 'trialing' && trialEnd
			? new Date(trialEnd)
			: currentPeriodEnd
				? new Date(currentPeriodEnd)
				: null

	const handleOpenPortal = () => {
		portalFetcher.submit({}, { method: 'POST', action: '/api/billing/portal' })
	}

	useEffect(() => {
		if (
			portalFetcher.state === 'idle' &&
			portalFetcher.data &&
			typeof portalFetcher.data === 'object' &&
			'data' in portalFetcher.data &&
			portalFetcher.data.data &&
			typeof portalFetcher.data.data === 'object' &&
			'portalUrl' in (portalFetcher.data.data as object)
		) {
			const portalUrl = (portalFetcher.data.data as { portalUrl: string })
				.portalUrl
			window.location.href = portalUrl
		}
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
							<Link to={isPaid ? '/pricing' : checkoutPath}>
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
			<section className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<StatTile
					label="Scenes"
					current={usage.scenesTotal}
					limit={usage.sceneLimit}
				/>
				<StatTile
					label="Projects"
					current={usage.projectsTotal}
					limit={usage.projectsLimit}
				/>
				<StatTile
					label="Published"
					current={usage.publishedScenes}
					limit={usage.publishedSceneLimit}
				/>
				<StatTile
					label="Opt. runs"
					current={usage.optimizationRuns}
					limit={usage.optimizationLimit}
					monthly
				/>
			</section>

			<Separator />

			{/* ── Detailed usage meters ────────────────────────── */}
			<section className="grid gap-8 md:grid-cols-2">
				<div className="space-y-4">
					<p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
						Content
					</p>
					<div className="space-y-3">
						<MeterRow
							label="Scenes (total)"
							current={usage.scenesTotal}
							limit={usage.sceneLimit}
						/>
						<MeterRow
							label="Published scenes"
							current={usage.publishedScenes}
							limit={usage.publishedSceneLimit}
						/>
						<MeterRow
							label="Projects"
							current={usage.projectsTotal}
							limit={usage.projectsLimit}
						/>
					</div>
				</div>
				<div className="space-y-4">
					<p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
						API &amp; processing
					</p>
					<div className="space-y-3">
						<MeterRow
							label="Optimization runs"
							current={usage.optimizationRuns}
							limit={usage.optimizationLimit}
							monthly
						/>
						<MeterRow
							label="API requests"
							current={usage.apiRequestsMonth}
							limit={usage.apiRequestsMonthLimit}
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
