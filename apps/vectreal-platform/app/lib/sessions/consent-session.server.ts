import { createCookie } from 'react-router'

import { CONSENT_POLICY_VERSION } from '../../constants/consent-policy'

export { CONSENT_POLICY_VERSION }

export const CONSENT_COOKIE_NAME = 'consent_prefs'

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
 * Unsigned consent cookie.
 *
 * Consent preferences are not security-sensitive data — they don't need HMAC
 * signing. Using an unsigned cookie means app-secret rotation (on every
 * deployment) never invalidates existing user consent, so the banner does not
 * re-appear after deploys. The cookie remains httpOnly to prevent XSS reads.
 */
export const consentCookie = createCookie(CONSENT_COOKIE_NAME, {
	httpOnly: true,
	maxAge: 60 * 60 * 24 * 365, // 1 year
	path: '/',
	sameSite: 'lax',
	secure: process.env.NODE_ENV === 'production'
	// No `secrets` — unsigned by design. See comment above.
})

/**
 * Parse the consent cookie from a raw Cookie header.
 * Returns null on any parse/validation error so callers never need to try-catch.
 */
export async function getConsentFromCookieHeader(
	cookieHeader: string | null
): Promise<ConsentCookieData | null> {
	try {
		const value = await consentCookie.parse(cookieHeader)
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
	} catch {
		return null
	}
}

/**
 * Serialize consent data into a Set-Cookie header value.
 */
export async function serializeConsentCookieHeader(
	data: ConsentCookieData
): Promise<string> {
	return consentCookie.serialize(data)
}
