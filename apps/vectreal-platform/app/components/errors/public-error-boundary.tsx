import { useRouteError } from 'react-router'

import { useErrorReport } from '../../lib/observability/use-error-report'
import { RouteErrorState } from '../not-found'

/**
 * The error state for the public marketing routes.
 *
 * Two things it deliberately does not do.
 *
 * It never renders `error.message`. An uncaught exception's message is written
 * for whoever is reading a stack trace - it can name a module, a column, or a
 * token - and putting it on a public page turns every bug into a disclosure.
 * `useErrorReport` sends it where it is useful. A `Response` thrown by a loader
 * is different: its `data` is copy someone wrote on purpose, so that is shown,
 * except on a 404, where the requested path says more than "not found" can.
 *
 * And it never offers "Try again" alone. Reload is only an answer when the
 * failure might be transient; on a 404 it re-fetches the same 404, which is a
 * button that does nothing wearing the label of a way out. Every state here
 * offers a link that leads somewhere.
 */
export function PublicErrorBoundary() {
	const error = useRouteError()
	useErrorReport(error)

	return <RouteErrorState error={error} />
}
