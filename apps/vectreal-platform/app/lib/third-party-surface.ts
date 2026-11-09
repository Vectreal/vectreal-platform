/**
 * Whether a page renders inside somebody else's site.
 *
 * `/embed/*` is shown in a customer's iframe, on their shop page, to their
 * visitors. Two things follow, and both read this one rule so they cannot
 * drift apart:
 *
 *   - No consent UI. A cookie banner there is not a first-party prompt at
 *     all: it is Vectreal chrome over the customer's content, attributed to
 *     them.
 *   - No analytics in the page. The browser never initializes PostHog there,
 *     so it sets nothing, fetches no remote config, surveys or recorder, and
 *     captures nothing from the customer's visitors. Being opted out is not
 *     enough: an initialized client still loads its remote config and the
 *     survey script, which runs on the merchant's page whatever the visitor
 *     chose. (The server's own error sink still reports a 5xx it raises
 *     while rendering an embed; that is our fault, not their visitor.)
 *
 * `/preview` is not one: it is the signed-in owner's own page on Vectreal,
 * opened from the dashboard, and its framing policy is `'self'`.
 *
 * Matched as a whole section, and case-insensitively, the way React Router
 * matches the routes that render there: `embed/*` also answers bare `/embed`
 * and `/EMBED/...`, and both render inside the customer's iframe. An embed
 * never navigates to another route, so reading the path once at load is
 * enough.
 */
const THIRD_PARTY_SECTIONS = ['/embed'] as const

export function isThirdPartySurface(pathname: string): boolean {
	const path = pathname.toLowerCase()
	return THIRD_PARTY_SECTIONS.some(
		(section) => path === section || path.startsWith(`${section}/`)
	)
}
