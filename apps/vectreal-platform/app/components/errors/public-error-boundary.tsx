import { Button } from '@shared/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { useErrorReport } from '../../lib/observability/use-error-report'

/**
 * The error state for the public marketing routes.
 *
 * Two things it deliberately does not do.
 *
 * It never renders `error.message`. An uncaught exception's message is written
 * for whoever is reading a stack trace - it can name a module, a column, or a
 * token - and putting it on a public page turns every bug into a disclosure.
 * `useErrorReport` sends it where it is useful. A `Response` thrown by a loader
 * is different: its `data` is copy someone wrote on purpose, so that is shown.
 *
 * And it never offers "Try again" alone. Reload is only an answer when the
 * failure might be transient; on a 404 it re-fetches the same 404, which is a
 * button that does nothing wearing the label of a way out. Every state here
 * offers a link that leads somewhere.
 */
export function PublicErrorBoundary() {
	const error = useRouteError()
	useErrorReport(error)

	let statusCode: number | undefined
	let title = 'Something went wrong'
	let message = 'Please try again in a moment.'
	let isRetryable = true

	if (isRouteErrorResponse(error)) {
		statusCode = error.status

		if (error.status === 404) {
			title = 'Page not found'
			message = 'That page has moved or never existed.'
			isRetryable = false
		} else if (error.status === 403) {
			title = 'Access denied'
			message = 'You do not have permission to view this page.'
			isRetryable = false
		} else if (error.status >= 500) {
			title = 'Server error'
			message = 'Something failed on our side. It is worth trying again.'
		}

		if (typeof error.data === 'string' && error.data.trim().length > 0) {
			message = error.data
		}
	}

	return (
		<div className="flex min-h-[calc(100dvh-5rem)] items-center justify-center p-6">
			<div className="ds-raised w-full max-w-lg rounded-2xl p-8 text-center">
				<div className="bg-destructive/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
					<AlertCircle
						className="text-destructive h-7 w-7"
						aria-hidden="true"
					/>
				</div>
				{statusCode ? (
					<p className="text-muted-foreground text-label-xs">
						Error {statusCode}
					</p>
				) : null}
				<h1 className="text-h3 font-heading mt-1">{title}</h1>
				<p className="text-muted-foreground text-body-sm mt-2">{message}</p>

				<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Button asChild>
						<Link to="/">Back to home</Link>
					</Button>
					{isRetryable ? (
						<Button variant="ghost" onClick={() => window.location.reload()}>
							Try again
						</Button>
					) : (
						<Button variant="ghost" asChild>
							<Link to="/docs">Browse the docs</Link>
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
