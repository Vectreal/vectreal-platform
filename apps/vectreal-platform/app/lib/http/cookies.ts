/**
 * Isomorphic helpers for plain, client-readable cookies (no signing, no
 * httpOnly). Used for non-secret per-visitor preferences (consent, theme) that
 * the client reads directly so their state never has to be baked into
 * CDN-cached HTML.
 */

/** Read a single cookie's raw (still URL-encoded) value from a Cookie header. */
export function readRawCookie(
	cookieHeader: string | null,
	name: string
): string | null {
	if (!cookieHeader) return null
	for (const part of cookieHeader.split(';')) {
		const eq = part.indexOf('=')
		if (eq === -1) continue
		if (part.slice(0, eq).trim() === name) {
			return part.slice(eq + 1).trim()
		}
	}
	return null
}

/** Client only: read a cookie straight from document.cookie. */
export function readClientCookie(name: string): string | null {
	if (typeof document === 'undefined') return null
	return readRawCookie(document.cookie, name)
}

/** Build a Set-Cookie header value for a plain, client-readable cookie. */
export function buildSetCookie(
	name: string,
	value: string,
	maxAgeSeconds: number
): string {
	const attributes = [
		`${name}=${value}`,
		`Max-Age=${maxAgeSeconds}`,
		'Path=/',
		'SameSite=Lax'
	]
	if (process.env.NODE_ENV === 'production') {
		attributes.push('Secure')
	}
	return attributes.join('; ')
}
