import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { AlertTriangle, LifeBuoy } from 'lucide-react'
import { Link } from 'react-router'

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function BillingCheckoutCanceledPage() {
	return (
		<div className="mx-auto w-full max-w-2xl p-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-amber-500" />
						Checkout was canceled
					</CardTitle>
					<CardDescription>
						No charge was made. Your current plan is still active and nothing
						has changed.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3 text-sm">
						<LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" />
						<p>
							If you paused to compare plans or timing, that is totally fine.
							You can jump back in whenever you are ready.
						</p>
					</div>
					<p className="text-muted-foreground text-sm">
						When you retry, we will take you back to the same transparent
						checkout review before any payment step.
					</p>
				</CardContent>
				<CardFooter className="flex gap-2">
					<Link to="/dashboard/billing/checkout">
						<Button>Return to checkout</Button>
					</Link>
					<Link to="/dashboard/billing">
						<Button variant="outline">Back to billing settings</Button>
					</Link>
				</CardFooter>
			</Card>
		</div>
	)
}
