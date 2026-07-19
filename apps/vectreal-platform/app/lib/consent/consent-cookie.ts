import { CONSENT_POLICY_VERSION } from '../../constants/consent-policy'

export { CONSENT_POLICY_VERSION }

export const CONSENT_COOKIE_NAME = 'consent_prefs'
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export interface ConsentChoices {
	necessary: true
	functional: boolean
	analytics: boolean
	marketing: boolean
}

export interface ConsentCookieData {
	version: string
	choices: ConsentChoices
}

/**
 * Isomorphic consent cookie helpers — the single source of truth for how
 * consent is encoded, read, and validated on both the server and the client.
 *
 * The cookie is intentionally NOT httpOnly and NOT signed: consent preferences
 * are not security-sensitive, and keeping them client-readable lets the banner
 * hydrate purely from `document.cookie`. That decouples banner visibility from
 * the server-rendered HTML, which is CDN-cached for anonymous visitors and
 * therefore cannot carry per-visitor state. Leaving it unsigned also means the
 * cookie survives app-secret rotation on every deploy, so the banner never
 * re-appears after a release.
 */

function normalizeConsentData(value: unknown): ConsentCookieData | null {
	if (!value || typeof value !== 'object') return null
	const data = value as Partial<ConsentCookieData>
	if (typeof data.version !== 'string' || !data.choices) return null
	const { choices } = data
	if (
		typeof choices.functional !== 'boolean' ||
		typeof choices.analytics !== 'boolean' ||
		typeof choices.marketing !== 'boolean'
	) {
		return null
	}
	return {
		version: data.version,
		choices: {
			necessary: true,
			functional: choices.functional,
			analytics: choices.analytics,
			marketing: choices.marketing
		}
	}
}

/** Encode consent data into a URL-safe cookie value (symmetric with decode). */
export function encodeConsentCookieValue(data: ConsentCookieData): string {
	return encodeURIComponent(JSON.stringify(data))
}

/** Decode a raw cookie value back into validated consent data, or null. */
export function decodeConsentCookieValue(
	raw: string | null | undefined
): ConsentCookieData | null {
	if (!raw) return null
	try {
		return normalizeConsentData(JSON.parse(decodeURIComponent(raw)))
	} catch {
		return null
	}
}

/** Read a single cookie's raw value out of a `Cookie` header string. */
function readRawCookie(
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

/** Parse validated consent data from a raw `Cookie` header (server or client). */
export function parseConsentCookieHeader(
	cookieHeader: string | null
): ConsentCookieData | null {
	return decodeConsentCookieValue(readRawCookie(cookieHeader, CONSENT_COOKIE_NAME))
}

/**
 * Client-only: read consent straight from `document.cookie`.
 * Returns null on the server or when no valid consent cookie exists.
 */
export function readConsentCookie(): ConsentCookieData | null {
	if (typeof document === 'undefined') return null
	return parseConsentCookieHeader(document.cookie)
}

/**
 * Build the `Set-Cookie` header value for consent (written on the server).
 * Pure string building — no secrets — so it lives alongside the encode/decode
 * pair the browser uses to read it back.
 */
export function buildConsentSetCookie(data: ConsentCookieData): string {
	const attributes = [
		`${CONSENT_COOKIE_NAME}=${encodeConsentCookieValue(data)}`,
		`Max-Age=${CONSENT_COOKIE_MAX_AGE}`,
		'Path=/',
		'SameSite=Lax'
	]
	if (process.env.NODE_ENV === 'production') {
		attributes.push('Secure')
	}
	return attributes.join('; ')
}
