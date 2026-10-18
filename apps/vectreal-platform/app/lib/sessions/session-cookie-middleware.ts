import { pendingSupabaseCookies, runInSupabaseScope } from '../supabase.server'

import type { Route } from '../../+types/root'

/**
 * Puts the session cookies Supabase wrote during a request on the response
 * the request ends with, whatever that response is.
 *
 * A token refresh rotates the refresh token, and the new one exists only in
 * the per-request `Headers` from `createSupabaseClient` until it reaches the
 * browser. Forwarding those headers by hand works on every path a route
 * returns through and on none it does not: React Router records no headers
 * for a thrown non-Response, so an error page went out without the rotated
 * cookie and the browser was signed out once Supabase stopped accepting the
 * spent token. Every response passes through here, document, `.data` and
 * resource route alike, so this is the one place the cookie cannot be missed,
 * and a route has no need to forward it. Some still pass `getAuthUser`'s
 * headers on; that is redundant rather than wrong.
 *
 * It also opens the request's Supabase scope, so the action and the loaders
 * that revalidate after it share one client even though React Router hands
 * the loaders a fresh Request. A cookie the route already forwarded is not
 * added twice.
 */
export const sessionCookieMiddleware: Route.MiddlewareFunction = async (
	{ request },
	next
) =>
	runInSupabaseScope(async () => {
		const response = (await next()) as Response
		const present = new Set(response.headers.getSetCookie())
		const missing = pendingSupabaseCookies(request).filter(
			(cookie) => !present.has(cookie)
		)
		if (missing.length === 0) return response

		// A Response from `fetch` has immutable headers; copy rather than throw.
		const headers = new Headers(response.headers)
		for (const cookie of missing) headers.append('Set-Cookie', cookie)
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		})
	})
