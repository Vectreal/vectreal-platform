import { Button } from '@shared/components/ui/button'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

export function PublicErrorBoundary() {
	const error = useRouteError()

	let statusCode: number | undefined
	let title = 'Something went wrong'
	let message = 'Please try again in a moment.'

	if (isRouteErrorResponse(error)) {
		statusCode = error.status
		if (error.status === 404) {
			title = 'Not Found'
			message = 'The page you requested could not be found.'
		} else if (error.status === 403) {
			title = 'Access Denied'
			message = 'You do not have permission to access this resource.'
		} else if (error.status >= 500) {
			title = 'Server Error'
			message = 'An unexpected error occurred. Please try again shortly.'
		}

		if (typeof error.data === 'string' && error.data.trim().length > 0) {
			message = error.data
		}
	} else if (error instanceof Error) {
		message = error.message
	}

	return (
		<div className="flex min-h-[calc(100vh-5rem)] items-center justify-center p-6">
			<div className="w-full max-w-lg rounded-2xl border p-6 text-center">
				<div className="bg-destructive/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
					<AlertCircle className="text-destructive h-7 w-7" />
				</div>
				{statusCode ? (
					<p className="text-muted-foreground text-sm font-medium">
						Error {statusCode}
					</p>
				) : null}
				<h1 className="mt-1 text-2xl font-semibold">{title}</h1>
				<p className="text-muted-foreground mt-2 text-sm">{message}</p>

				<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button onClick={() => window.location.reload()}>
						<RefreshCw className="mr-2 h-4 w-4" />
						Try Again
					</Button>
					<Link to="/" viewTransition>
						<Button variant="outline" className="w-full sm:w-auto">
							<Home className="mr-2 h-4 w-4" />
							Go Home
						</Button>
					</Link>
				</div>
			</div>
		</div>
	)
}
