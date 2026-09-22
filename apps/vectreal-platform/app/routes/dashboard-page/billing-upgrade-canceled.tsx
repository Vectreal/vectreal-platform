import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { ArrowRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { isPaidPlan } from '../../constants/plan-config'
import { PLAN_DISPLAY_NAMES } from '../../constants/product-copy'

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function BillingUpgradeCanceledPage() {
	const [searchParams] = useSearchParams()

	/*
	  Validated, not cast to a key. Stripe returns whatever the cancel URL
	  carried and the reader can edit it, so `?plan=toString` used to find a
	  truthy "label" here and render a function body. `isPaidPlan` is the same
	  list checkout validates against, so a parameter naming anything else is
	  simply not a plan this page can have arrived from.
	*/
	const requested = searchParams.get('plan')
	const plan = isPaidPlan(requested) ? requested : null
	const planLabel = plan ? PLAN_DISPLAY_NAMES[plan] : null

	const upgradeHref = plan
		? `/dashboard/billing/upgrade?plan=${plan}`
		: '/dashboard/billing/upgrade'

	return (
		<div className="mx-auto w-full max-w-xl p-6">
			<Card>
				<CardHeader className="space-y-2">
					<CardTitle>No problem - nothing changed</CardTitle>
					{/*
					  It pointed at `/pricing` for "the full feature comparison", which
					  is the marketing page, written for visitors who have no account.
					  The reader is signed in and mid-way through changing plan; the
					  comparison for their organization is on the route this sends
					  them back to.

					  "Upgrade to" is gone for the same reason the confirmation page
					  lost it: checkout sells Business to Pro too, and this page cannot
					  tell which way the abandoned change went.
					*/}
					<p className="text-muted-foreground text-sm">
						No charge was made and your plan is unchanged. You can pick up where
						you left off whenever you are ready.
					</p>
				</CardHeader>

				<CardFooter className="flex flex-col gap-3">
					<Link to={upgradeHref} className="w-full">
						<Button size="lg" className="w-full gap-2">
							{planLabel ? `Back to ${planLabel}` : 'Choose a plan'}
							<ArrowRight className="h-4 w-4" />
						</Button>
					</Link>
					<Link
						to="/dashboard/billing"
						className="text-muted-foreground hover:text-foreground text-center text-sm transition-colors"
					>
						Back to billing settings
					</Link>
				</CardFooter>
			</Card>
		</div>
	)
}
