import { data } from 'react-router'

import { NotFound, notFoundMeta } from '../components/not-found'

/**
 * The site-wide fallback for any URL no other route matches.
 *
 * Without it, React Router answers a miss with an internal 404 that carries an
 * `Error`, and its server runtime hands that to `handleError`, so every scanner
 * probing `/.env` or `/wp-content/` was reported to error tracking as an
 * exception. A thrown 404 that carries no error is never reported.
 *
 * Thrown rather than returned, so a fetcher or form aimed at an endpoint that
 * does not exist still fails. A returned 404 reaches a fetcher as `data: null`
 * with no error, because single fetch only treats a status as a failure when
 * the response did not come from a route. The action exists for the same
 * reason: a POST to a route without one is a 405 that also carries an error.
 */
export function loader(): never {
	throw data(null, { status: 404 })
}

export function action(): never {
	throw data(null, { status: 404 })
}

export const meta = notFoundMeta

export default NotFound

export { PublicErrorBoundary as ErrorBoundary } from '../components/errors'
