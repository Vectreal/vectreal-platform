import { usePostHog } from '@posthog/react'
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
import { useCallback, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'

import { DASHBOARD_ROUTES } from '../../constants/dashboard'
import { isPaidPlan } from '../../constants/plan-config'
import { PLAN_DISPLAY_NAMES } from '../../constants/product-copy'
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UpgradeModal() {
	const [state, setState] = useAtom(upgradeModalAtom)
	const location = useLocation()
	const posthog = usePostHog()
	const wasOpenRef = useRef(false)

	const handleOpenChange = useCallback(
		(open: boolean) => {
			setState((prev) => ({ ...prev, open }))
		},
		[setState]
	)

	const closeModal = useCallback(() => {
		setState((prev) => ({ ...prev, open: false }))
	}, [setState])

	// Fire analytics events when the modal transitions from closed to open
	useEffect(() => {
		if (state.open && !wasOpenRef.current) {
			posthog?.capture('upgrade_modal_opened', {
				reason: state.reason,
				plan: state.plan,
				limit_key: state.limitKey,
				action_attempted: state.actionAttempted
			})

			if (state.reason === 'quota_exceeded') {
				posthog?.capture('limit_gate_shown', {
					limit_key: state.limitKey ?? 'unknown',
					plan: state.plan,
					action_attempted: state.actionAttempted
				})
			}
		}
		wasOpenRef.current = state.open
	}, [
		state.open,
		state.reason,
		state.plan,
		state.limitKey,
		state.actionAttempted,
		posthog
	])

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

	const currentPlanLabel = state.plan ? PLAN_DISPLAY_NAMES[state.plan] : null
	const upgradeToLabel = state.upgradeTo
		? PLAN_DISPLAY_NAMES[state.upgradeTo]
		: null

	const usagePercent =
		state.limit != null && state.currentValue != null
			? Math.min(Math.round((state.currentValue / state.limit) * 100), 100)
			: null
	const isPublisherFlow =
		location.pathname.startsWith('/publisher') &&
		(state.actionAttempted === 'optimization_run' ||
			state.actionAttempted === 'scene_publish')

	/*
	  One door, and it stays in the product.

	  This offered two: "Upgrade to X" to the upgrade route, and beside it "View
	  all plans" to `/pricing`, the marketing page written for an anonymous
	  visitor - its Free card's call to action is "Sign up". Every refusal in the
	  app led half its readers out of the dashboard to read about signing up for
	  an account they already have. The upgrade route now shows every plan they
	  can move to, so the second door had nowhere to go that the first does not.

	  A Business organization is recommended Enterprise, which checkout does not
	  sell, and this sent it to `/pricing` as well. Enterprise is a conversation,
	  so it goes to the people who have it.
	*/
	/*
	  Every refusal leads somewhere. `upgradeTo` is absent on more paths than it
	  is present - a `plan_inactive` 402 carries no target, and neither does a
	  refusal the server raised without naming a plan - and the footer then held
	  "Maybe later" alone: a dialog that says the reader cannot continue and
	  offers no way to change that.

	  An inactive plan is not an upgrade problem. Nothing about buying a larger
	  plan fixes a payment that did not go through, so that one door opens on
	  billing, where the portal and the invoices are. Everything else opens on
	  the plan-change page, which picks a sensible target itself when none was
	  asked for.
	*/
	const upgradeHref =
		isPaidPlan(state.upgradeTo)
			? `${DASHBOARD_ROUTES.BILLING_UPGRADE}?plan=${state.upgradeTo}`
			: state.upgradeTo === 'enterprise'
				? '/contact'
				: state.reason === 'plan_inactive'
					? DASHBOARD_ROUTES.BILLING
					: DASHBOARD_ROUTES.BILLING_UPGRADE

	const upgradeLabel = upgradeToLabel
		? state.upgradeTo === 'enterprise'
			? 'Talk to us about Enterprise'
			: `Upgrade to ${upgradeToLabel}`
		: state.reason === 'plan_inactive'
			? 'Go to billing'
			: 'See your options'

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
					{isPublisherFlow ? (
						<Link to="/dashboard" onClick={closeModal} className="sm:mr-auto">
							<Button variant="ghost">Back to Dashboard</Button>
						</Link>
					) : (
						<Button variant="ghost" onClick={closeModal} className="sm:mr-auto">
							Maybe later
						</Button>
					)}
					<Button size="sm" className="gap-1.5" asChild>
						<Link to={upgradeHref} onClick={closeModal}>
							<Zap className="h-3.5 w-3.5" />
							{upgradeLabel}
						</Link>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
