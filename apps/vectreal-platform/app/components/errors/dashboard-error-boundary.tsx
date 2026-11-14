import { Button } from '@shared/components/ui/button'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import {
	PUBLIC_ERROR_COPY,
	publicErrorKind,
	routeErrorDetail
} from '../../lib/errors/error-state-copy'
import { useErrorReport } from '../../lib/observability/use-error-report'

/**
 * Error boundary component for dashboard routes.
 *
 * Re-exported as `ErrorBoundary` by every dashboard route, so this one call is
 * what makes those routes report rather than swallow.
 *
 * Its words come from the same table as the public site's, and like that
 * boundary it never renders an uncaught exception's message or stack: those
 * are written for whoever reads a trace, can name a module or carry a token,
 * and `useErrorReport` already sends them where they are useful. A string a
 * loader threw on purpose is shown, except on a 404.
 */
export function DashboardErrorBoundary() {
	const error = useRouteError()
	useErrorReport(error)

	const kind = publicErrorKind(error)
	const { heading, description } = PUBLIC_ERROR_COPY[kind]
	const detail = kind === 'not_found' ? undefined : routeErrorDetail(error)
	const statusCode = isRouteErrorResponse(error) ? error.status : undefined

	const handleReload = () => {
		window.location.reload()
	}

	return (
		<div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-6">
			<div className="w-full max-w-md space-y-6 text-center">
				{/* Error Icon */}
				<div className="bg-destructive/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
					<AlertCircle className="text-destructive h-10 w-10" />
				</div>

				{/* Error Message */}
				<div className="space-y-2">
					{statusCode && (
						<p className="text-muted-foreground text-sm font-medium">
							Error {statusCode}
						</p>
					)}
					<h1 className="text-2xl font-medium">{heading}</h1>
					<p className="text-muted-foreground text-sm">
						{detail ?? description}
					</p>
				</div>

				{/* Action Buttons */}
				<div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button onClick={handleReload} variant="default">
						<RefreshCw className="mr-2 h-4 w-4" />
						Try again
					</Button>
					<Link to="/dashboard" viewTransition>
						<Button variant="outline" className="w-full sm:w-auto">
							<Home className="mr-2 h-4 w-4" />
							Go to dashboard
						</Button>
					</Link>
				</div>

				{/* Development Mode Details */}
				{process.env.NODE_ENV === 'development' && error instanceof Error && (
					<details className="bg-muted mt-6 rounded-lg p-4 text-left">
						<summary className="text-muted-foreground cursor-pointer text-sm font-medium">
							Error Details (Development Only)
						</summary>
						<pre className="text-muted-foreground mt-2 overflow-auto text-xs">
							{error.stack}
						</pre>
					</details>
				)}
			</div>
		</div>
	)
}
