import { ApiResponse } from '@shared/utils'

/**
 * Cache headers for API and loader responses, one spelling each.
 *
 * `withNoStore` was defined three times (the scene route, the assets route and
 * the preview layout) and the manifest's conditional response twice in one
 * file. Pure and free of the database, so a spec can import it.
 */

/** The response, re-issued with `Cache-Control: no-store`. */
export function withNoStore(response: Response): Response {
	const headers = new Headers(response.headers)
	headers.set('Cache-Control', 'no-store')
	return new Response(response.body, {
		status: response.status,
		headers
	})
}

/** Headers for a response built from scratch that must never be cached. */
export function noStoreHeaders(init?: HeadersInit): Headers {
	const headers = new Headers(init)
	headers.set('Cache-Control', 'no-store')
	return headers
}

/**
 * A scene manifest, revalidated against its ETag.
 *
 * `private, no-cache` lets the browser keep a copy but makes it ask first, so
 * an unchanged manifest costs a 304 and no body. `headers` carries whatever the
 * caller's auth attached, such as a refreshed session cookie.
 */
export function manifestResponse(
	request: Request,
	manifest: unknown,
	etag: string | null,
	headers?: HeadersInit
): Response {
	const response =
		etag && request.headers.get('If-None-Match') === etag
			? new Response(null, { status: 304, headers: new Headers(headers) })
			: ApiResponse.success(
					manifest,
					200,
					headers ? { headers: new Headers(headers) } : undefined
				)

	const cached = new Headers(response.headers)
	cached.set('Cache-Control', 'private, no-cache')
	if (etag) cached.set('ETag', etag)
	return new Response(response.body, {
		status: response.status,
		headers: cached
	})
}
