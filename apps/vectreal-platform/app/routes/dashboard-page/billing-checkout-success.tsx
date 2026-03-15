import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

export default function BillingCheckoutSuccessPage() {
	const [searchParams] = useSearchParams()
	const sessionId = searchParams.get('session_id')

	return (
		<div className="mx-auto w-full max-w-2xl p-6">
			<Card className="border-primary/20 from-background via-background to-primary/5 bg-gradient-to-br">
				<CardHeader>
					<div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
						<Sparkles className="h-3.5 w-3.5" />
						You are all set
					</div>
					<CardTitle className="flex items-center gap-2">
						<CheckCircle2 className="h-5 w-5 text-green-500" />
						Payment received successfully
					</CardTitle>
					<CardDescription>
						Thanks for upgrading. Your workspace will reflect the new plan as
						soon as the billing sync finishes.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2">
					<p className="text-sm">What happens next:</p>
					<ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
						<li>Your plan entitlements refresh automatically.</li>
						<li>
							You can manage invoices and payment methods in billing settings.
						</li>
						<li>If things look delayed, a page refresh usually picks it up.</li>
					</ul>
					{sessionId && (
						<p className="text-muted-foreground text-xs">
							Session ID: {sessionId}
						</p>
					)}
				</CardContent>
				<CardFooter className="flex gap-2">
					<Link to="/dashboard/billing">
						<Button>Open billing settings</Button>
					</Link>
					<Link to="/dashboard">
						<Button variant="outline">Back to dashboard</Button>
					</Link>
				</CardFooter>
			</Card>
		</div>
	)
}
