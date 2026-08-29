/**
 * Turns a React Router single-fetch pathname back into the route it serves.
 *
 * With JavaScript running, a form submission or navigation does not post to
 * `/sign-up` - it posts to `/sign-up.data`. Anything matching a request against
 * a route pattern therefore has to strip the suffix first, or it silently
 * matches nothing for every real user while continuing to work in a test that
 * passes the plain path.
 *
 * React Router 8 is trailing-slash aware: a path ending in `/` gets `_.data`
 * appended (`/` → `/_.data`, `/docs/` → `/docs/_.data`), everything else gets
 * `.data`. Stripping only the bare suffix would leave `/_` behind.
 *
 * Pure and free of any server import, because both readers need it: the cache
 * policy, which is server-only, and the critical-flow tagger, which is not.
 */
export function stripSingleFetchSuffix(pathname: string): string {
	if (pathname.endsWith('/_.data')) {
		return pathname.slice(0, -'_.data'.length)
	}

	return pathname.endsWith('.data')
		? pathname.slice(0, -'.data'.length)
		: pathname
}
