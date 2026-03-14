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
import { Progress } from '@shared/components/ui/progress'
import { Separator } from '@shared/components/ui/separator'
import { cn } from '@shared/utils'
import {
	AlertTriangle,
	ArrowUpRight,
	CheckCircle2,
	CreditCard,
	ExternalLink,
	HelpCircle,
	Zap
} from 'lucide-react'
import { useEffect } from 'react'
import { useFetcher } from 'react-router'
import { Link } from 'react-router'

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
		description:
			'Checkout expired. Access has reverted to the Free tier.'
	}
}

function UsageRow({
	label,
	current,
	limit
}: {
	label: string
	current: number
	limit: number | null
}) {
	const unlimited = limit === null
	const percent = unlimited ? 0 : Math.min(Math.round((current / limit) * 100), 100)
	const nearLimit = !unlimited && percent >= 80

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between text-sm">
				<span>{label}</span>
				<span className={cn('font-medium tabular-nums', nearLimit && 'text-destructive')}>
					{current.toLocaleString()}
					{!unlimited && ` / ${limit.toLocaleString()}`}
					{unlimited && ' / ∞'}
				</span>
			</div>
			{!unlimited && (
				<Progress
					value={percent}
					className={cn('h-1.5', nearLimit && '[&>div]:bg-destructive')}
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
	defaultUpgradeTarget?: 'pro' | 'business' | null
}

export function BillingSettingsSection({
	billing,
	defaultUpgradeTarget
}: BillingSettingsSectionProps) {
	const { plan, billingState, currentPeriodEnd, trialEnd, usage } = billing
	const portalFetcher = useFetcher()

	const stateConfig = BILLING_STATE_CONFIG[billingState]
	const StateIcon = stateConfig.icon
	const planLabel = PLAN_LABELS[plan]
	const isPaid = plan !== 'free'
	const isEnterprise = plan === 'enterprise'

	const renewalDate =
		billingState === 'trialing' && trialEnd
			? new Date(trialEnd)
			: currentPeriodEnd
				? new Date(currentPeriodEnd)
				: null

	const handleOpenPortal = () => {
		portalFetcher.submit(
			{},
			{ method: 'POST', action: '/api/billing/portal' }
		)
	}

	// Redirect to Stripe portal when the fetcher resolves
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
		<div className="space-y-6">
			{/* Upgrade banner when user navigated here with ?upgrade=... */}
			{defaultUpgradeTarget && !isPaid && (
				<div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
					<p className="text-primary text-sm font-medium">
						Ready to upgrade to {PLAN_LABELS[defaultUpgradeTarget]}? Complete your
						checkout below.
					</p>
				</div>
			)}
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2">
								<CreditCard className="h-5 w-5" />
								Current plan
							</CardTitle>
							<CardDescription>
								Your organisation&apos;s active subscription
							</CardDescription>
						</div>
						<Badge
							variant={stateConfig.variant}
							className="flex items-center gap-1"
						>
							<StateIcon className="h-3 w-3" />
							{stateConfig.label}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground text-sm">Plan</span>
						<span className="text-lg font-semibold">{planLabel}</span>
					</div>

					{renewalDate && (
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								{billingState === 'trialing' ? 'Trial ends' : 'Renews'}
							</span>
							<span className="font-medium">
								{renewalDate.toLocaleDateString(undefined, {
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})}
							</span>
						</div>
					)}

					{/* State description */}
					<div
						className={cn(
							'rounded-lg p-3 text-sm',
							['past_due', 'unpaid', 'incomplete', 'incomplete_expired'].includes(
								billingState
							)
								? 'bg-destructive/10 text-destructive'
								: 'bg-muted/50'
						)}
					>
						{stateConfig.description}
					</div>
				</CardContent>
				<CardFooter className="flex flex-wrap gap-2">
					{isPaid && !isEnterprise && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleOpenPortal}
							disabled={portalFetcher.state !== 'idle'}
						>
							<ExternalLink className="mr-1.5 h-3.5 w-3.5" />
							{portalFetcher.state !== 'idle' ? 'Opening…' : 'Manage billing'}
						</Button>
					)}

					{!isEnterprise && (
						<Link to="/pricing">
							<Button size="sm" variant={isPaid ? 'ghost' : 'default'}>
								<ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
								{isPaid ? 'View all plans' : 'Upgrade plan'}
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
				</CardFooter>
			</Card>

			{/* Usage summary */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Usage this month</CardTitle>
					<CardDescription>
						Counters reset at the start of each calendar month (UTC).
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<UsageRow
						label="Scenes"
						current={usage.scenesTotal}
						limit={usage.sceneLimit}
					/>
					<Separator />
					<UsageRow
						label="Optimization runs"
						current={usage.optimizationRuns}
						limit={usage.optimizationLimit}
					/>
					<Separator />
					<UsageRow
						label="Projects"
						current={usage.projectsTotal}
						limit={usage.projectsLimit}
					/>
				</CardContent>
				<CardFooter>
					<p className="text-muted-foreground text-xs">
						Need more? &nbsp;
						<Link to="/pricing" className="text-primary underline-offset-4 hover:underline">
							Compare plans
						</Link>
						&nbsp;or&nbsp;
						<Link to="/contact" className="text-primary underline-offset-4 hover:underline">
							contact us
						</Link>.
					</p>
				</CardFooter>
			</Card>

			{/* Support links */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Help &amp; support</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<a
						href="https://discord.gg/vectreal"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary flex items-center gap-1.5 underline-offset-4 hover:underline"
					>
						Community Discord
						<ExternalLink className="h-3 w-3" />
					</a>
					<Link
						to="/docs"
						className="text-primary flex items-center gap-1.5 underline-offset-4 hover:underline"
					>
						Documentation
					</Link>
					<Link
						to="/contact"
						className="text-primary flex items-center gap-1.5 underline-offset-4 hover:underline"
					>
						Email support
					</Link>
				</CardContent>
			</Card>
		</div>
	)
}
