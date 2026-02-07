import { Button } from '@shared/components/ui/button'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

/**
 * Error boundary component for dashboard routes.
 * Displays user-friendly error messages with retry/navigation options.
 */
export function DashboardErrorBoundary() {
	const error = useRouteError()

	let errorMessage = 'An unexpected error occurred'
	let errorDetails: string | undefined
	let statusCode: number | undefined

	if (isRouteErrorResponse(error)) {
		statusCode = error.status
		errorMessage = error.statusText || errorMessage

		if (error.status === 404) {
			errorMessage = 'Page Not Found'
			errorDetails = 'The page you are looking for does not exist.'
		} else if (error.status === 403) {
			errorMessage = 'Access Denied'
			errorDetails = 'You do not have permission to access this resource.'
		} else if (error.status === 500) {
			errorMessage = 'Server Error'
			errorDetails = 'Something went wrong on our end. Please try again later.'
		}

		if (error.data && typeof error.data === 'string') {
			errorDetails = error.data
		}
	} else if (error instanceof Error) {
		errorMessage = error.message
		errorDetails = error.stack
		console.error('Dashboard error:', error)
	}

	const handleReload = () => {
		window.location.reload()
	}

	return (
		<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
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
					<h1 className="text-2xl font-bold">{errorMessage}</h1>
					{errorDetails && (
						<p className="text-muted-foreground text-sm">{errorDetails}</p>
					)}
				</div>

				{/* Action Buttons */}
				<div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button onClick={handleReload} variant="default">
						<RefreshCw className="mr-2 h-4 w-4" />
						Try Again
					</Button>
					<Link to="/dashboard" viewTransition>
						<Button variant="outline" className="w-full sm:w-auto">
							<Home className="mr-2 h-4 w-4" />
							Go to Dashboard
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
