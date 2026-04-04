import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { ArrowRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const PLAN_LABELS: Record<string, string> = {
	pro: 'Pro',
	business: 'Business'
}

export default function BillingUpgradeCanceledPage() {
	const [searchParams] = useSearchParams()
	const plan = searchParams.get('plan')
	const planLabel = plan ? (PLAN_LABELS[plan] ?? null) : null

	const upgradeHref = plan
		? `/dashboard/billing/upgrade?plan=${plan}`
		: '/dashboard/billing/upgrade'

	return (
		<div className="mx-auto w-full max-w-xl p-6">
			<Card>
				<CardHeader className="space-y-2">
					<CardTitle>No problem — nothing changed</CardTitle>
					<p className="text-muted-foreground text-sm">
						No charge was made. Your current plan is still active and nothing
						has changed.{' '}
						{planLabel
							? `You can come back and upgrade to ${planLabel} whenever you're ready.`
							: "You can come back and upgrade whenever you're ready."}
					</p>
				</CardHeader>

				<CardContent>
					<p className="text-muted-foreground text-sm">
						If you want to compare plans or think it over, the full feature
						comparison is on the{' '}
						<Link
							to="/pricing"
							className="text-foreground underline underline-offset-2"
						>
							pricing page
						</Link>
						.
					</p>
				</CardContent>

				<CardFooter className="flex flex-col gap-3">
					<Link to={upgradeHref} className="w-full">
						<Button size="lg" className="w-full gap-2">
							{planLabel ? `Upgrade to ${planLabel}` : 'Choose a plan'}
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
