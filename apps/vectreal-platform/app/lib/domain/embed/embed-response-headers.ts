/**
 * The headers every `/embed` response carries, whatever its status.
 *
 * An embed URL carries its API key in the query string, because an iframe
 * cannot set request headers. That is not a leak in itself - the same token is
 * in the `src` of every customer's embed, visible to anyone who views source -
 * but it does mean the URL must not be retained anywhere that outlives the
 * request, and a search index is exactly that.
 *
 * Pure, and separate from the route, because `embed-layout.tsx` reaches
 * `getDbClient()` on import and throws without `DATABASE_URL`, so no spec can
 * import it. This is the `scene-route-params.ts` pattern.
 */

export const EMBED_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
	/**
	 * Never cached: the response depends on a token, a referer and the scene's
	 * publication state, none of which are in the cache key.
	 */
	'Cache-Control': 'no-store',

	/**
	 * The control that actually keeps tokenized URLs out of search results.
	 *
	 * `/embed` already renders `<meta name="robots" content="noindex, nofollow">`
	 * through `buildMeta(..., { private: true })`, but a meta tag only works if
	 * the crawler renders the page. The header does not depend on that, and it
	 * applies to the error responses too, which render no document at all.
	 */
	'X-Robots-Tag': 'noindex, nofollow',

	/**
	 * Defense in depth, matching what browsers already default to.
	 *
	 * Nothing in the app sets a referrer policy, so the current default already
	 * sends only the origin cross-origin and the token never rides along. Stating
	 * it means a laxer policy introduced later cannot silently start leaking a
	 * tokenized URL to every third-party host an embed happens to touch.
	 */
	'Referrer-Policy': 'strict-origin-when-cross-origin'
}

/**
 * Re-issues `response` carrying the headers above.
 *
 * Applied to every return from the embed loader, not only the successful one.
 * A 404 for an unpublished scene and a 403 for a disallowed domain are just as
 * indexable as a 200, and they are the ones a crawler is most likely to reach.
 */
export function withEmbedResponseHeaders(response: Response): Response {
	const headers = new Headers(response.headers)

	for (const [name, value] of Object.entries(EMBED_RESPONSE_HEADERS)) {
		headers.set(name, value)
	}

	return new Response(response.body, {
		status: response.status,
		headers
	})
}
