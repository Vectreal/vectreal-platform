import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
import { Progress } from '@shared/components/ui/progress'
import { useAtom } from 'jotai/react'
import { AlertTriangle, Lock, TrendingUp, Zap } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router'

import { upgradeModalAtom } from '../../lib/stores/upgrade-modal-store'

import type { UpgradeModalDenialReason } from '../../lib/stores/upgrade-modal-store'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REASON_CONFIG: Record<
	UpgradeModalDenialReason,
	{
		icon: typeof Lock
		badgeLabel: string
		badgeVariant: 'destructive' | 'secondary' | 'outline'
	}
> = {
	quota_exceeded: {
		icon: TrendingUp,
		badgeLabel: 'Quota reached',
		badgeVariant: 'destructive'
	},
	feature_not_available: {
		icon: Lock,
		badgeLabel: 'Feature locked',
		badgeVariant: 'secondary'
	},
	plan_inactive: {
		icon: AlertTriangle,
		badgeLabel: 'Plan inactive',
		badgeVariant: 'destructive'
	}
}

const PLAN_LABELS: Record<string, string> = {
	free: 'Free',
	pro: 'Pro',
	business: 'Business',
	enterprise: 'Enterprise'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpgradeModal() {
	const [state, setState] = useAtom(upgradeModalAtom)
	const location = useLocation()

	const handleOpenChange = useCallback(
		(open: boolean) => {
			setState((prev) => ({ ...prev, open }))
		},
		[setState]
	)

	const closeModal = useCallback(() => {
		setState((prev) => ({ ...prev, open: false }))
	}, [setState])

	useEffect(() => {
		if (
			state.open &&
			(location.pathname.startsWith('/dashboard/billing') ||
				location.pathname === '/pricing')
		) {
			setState((prev) => ({ ...prev, open: false }))
		}
	}, [location.pathname, setState, state.open])

	const config = REASON_CONFIG[state.reason]
	const Icon = config.icon

	const currentPlanLabel = state.plan ? PLAN_LABELS[state.plan] : null
	const upgradeToLabel = state.upgradeTo ? PLAN_LABELS[state.upgradeTo] : null

	const usagePercent =
		state.limit != null && state.currentValue != null
			? Math.min(Math.round((state.currentValue / state.limit) * 100), 100)
			: null

	// Build the upgrade destination: settings page with plan pre-selected, or pricing
	const upgradeHref =
		state.upgradeTo && state.upgradeTo !== 'enterprise'
			? `/dashboard/billing/checkout?plan=${state.upgradeTo}`
			: '/pricing'

	return (
		<Dialog open={state.open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="mb-2 flex items-center gap-3">
						<div className="bg-destructive/10 rounded-lg p-2">
							<Icon className="text-destructive h-5 w-5" />
						</div>
						<Badge variant={config.badgeVariant}>{config.badgeLabel}</Badge>
						{currentPlanLabel && (
							<Badge variant="outline">{currentPlanLabel} plan</Badge>
						)}
					</div>
					<DialogTitle>Upgrade to continue</DialogTitle>
					<DialogDescription className="text-sm leading-relaxed">
						{state.message}
					</DialogDescription>
				</DialogHeader>

				{/* Usage bar */}
				{usagePercent !== null && state.limit != null && (
					<div className="space-y-1.5 rounded-lg border p-3">
						<div className="flex justify-between text-xs">
							<span className="text-muted-foreground">Usage</span>
							<span className="font-medium">
								{state.currentValue?.toLocaleString()} /{' '}
								{state.limit.toLocaleString()}
							</span>
						</div>
						<Progress value={usagePercent} className="h-2" />
						<p className="text-muted-foreground text-xs">
							{usagePercent}% of your plan limit used
						</p>
					</div>
				)}

				<DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
					<Button variant="ghost" onClick={closeModal} className="sm:mr-auto">
						Maybe later
					</Button>
					<div className="flex gap-2">
						<Link to="/pricing" onClick={closeModal}>
							<Button variant="outline" size="sm">
								View all plans
							</Button>
						</Link>
						{upgradeToLabel && (
							<Link to={upgradeHref} onClick={closeModal}>
								<Button size="sm" className="gap-1.5">
									<Zap className="h-3.5 w-3.5" />
									Upgrade to {upgradeToLabel}
								</Button>
							</Link>
						)}
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
