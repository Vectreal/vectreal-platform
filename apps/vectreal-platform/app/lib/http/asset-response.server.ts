/**
 * How a stored scene asset goes out on the wire, for the assets and thumbnail
 * routes alike. Both carried their own copy of the MIME allowlist and of the
 * header set below until this module.
 */

/**
 * Asset rows are content-addressed per save: new bytes always get a new UUID
 * (upsert: false, path embeds assetId), so immutable caching is safe.
 */
export const ASSET_CACHE_CONTROL = 'private, max-age=31536000, immutable'

/**
 * Only these MIME types are served verbatim. Anything else (including
 * text/html, image/svg+xml, application/xml, and unknown types) is downgraded
 * to application/octet-stream to prevent stored XSS via client-supplied types.
 */
const PASSIVE_MIME_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/ktx2',
	'image/avif',
	'model/gltf-binary',
	'model/gltf+json',
	'application/octet-stream'
])

export function sanitizeMimeType(mimeType: string | undefined | null): string {
	if (!mimeType || !PASSIVE_MIME_TYPES.has(mimeType)) {
		return 'application/octet-stream'
	}
	return mimeType
}

/**
 * The asset's bytes with a sanitized type, `nosniff`, and a sandbox CSP, so a
 * file opened directly can never run as a document.
 */
export function assetResponse(
	data: Uint8Array,
	mimeType: string,
	extraHeaders?: HeadersInit,
	cacheControl = ASSET_CACHE_CONTROL
): Response {
	const headers = new Headers(extraHeaders)
	headers.set('Content-Type', sanitizeMimeType(mimeType))
	headers.set('Cache-Control', cacheControl)
	headers.set('X-Content-Type-Options', 'nosniff')
	headers.set('Content-Security-Policy', 'sandbox')
	return new Response(new Blob([Buffer.from(data)]), { status: 200, headers })
}
