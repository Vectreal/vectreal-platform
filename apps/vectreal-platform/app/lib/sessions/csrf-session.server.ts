import { createCookie } from 'react-router'
import { CSRF } from 'remix-utils/csrf/server'

const csrfSecret = process.env.CSRF_SECRET ?? process.env.SESSION_SECRET

if (!csrfSecret && process.env.NODE_ENV === 'production') {
	throw new Error('CSRF secret is required in production')
}

const resolvedCsrfSecret = csrfSecret || 'dev-only-csrf-secret'

export const cookie = createCookie('csrf', {
	path: '/',
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax',
	secrets: [resolvedCsrfSecret]
})

/**
 * Key the CSRF token travels under inside a `FormData` body.
 *
 * Must stay in sync with the `formDataKey` handed to `CSRF` below - anything
 * building a carrier `FormData` for `CSRF#validate` has to use the same key, or
 * validation fails with `missing_token_in_body` and reads like a client bug.
 */
export const CSRF_FORM_DATA_KEY = 'csrf'

export const csrfSession = new CSRF({
	cookie,
	// what key in FormData objects will be used for the token, defaults to `csrf`
	formDataKey: CSRF_FORM_DATA_KEY,
	// an optional secret used to sign the token, recommended for extra safety
	secret: resolvedCsrfSecret
})

/**
 * Wrap a bare token in the one-field `FormData` that `CSRF#validate` expects.
 *
 * `CSRF#validate` only ever reads the token out of a `FormData` under
 * `formDataKey`; there is no public entry point taking a bare string, so any
 * caller holding just the token has to hand it a carrier.
 */
export function buildCsrfCarrier(token: string): FormData {
	const carrier = new FormData()
	carrier.set(CSRF_FORM_DATA_KEY, token)
	return carrier
}

/**
 * Commit a CSRF token that is guaranteed to validate, re-minting a stale one.
 *
 * `CSRF#commitToken` mints a new token only when the `csrf` cookie is absent
 * entirely - a cookie that parses but carries an unusable token is echoed back
 * verbatim with a `null` Set-Cookie, forever. Two ways that happens:
 *
 *   1. The token was signed by an older remix-utils. v8 signed with an unkeyed
 *      `sha256`, v10 with an HMAC. The cookie's own signature layer
 *      (`secrets: [resolvedCsrfSecret]`) is untouched by that change, so the
 *      cookie still unsigns cleanly and `commitToken` sees a perfectly good
 *      string - it is the *inner* token signature that no longer verifies.
 *   2. The cookie payload decodes to a non-string. React Router's `decodeData`
 *      returns `{}` for malformed JSON, and `commitToken` tests the raw value
 *      for truthiness when deciding whether to emit Set-Cookie but for
 *      `typeof === 'string'` when deciding whether to reuse it - so a truthy
 *      non-string yields a fresh token with no cookie to match it.
 *
 * Either way every subsequent POST 403s until the visitor clears cookies by
 * hand. So probe the committed token and, when it will not validate, force a
 * fresh mint plus the Set-Cookie that makes it stick.
 *
 * @returns The same `[token, setCookieHeader]` tuple shape as `commitToken`. On
 * the happy path this is exactly what `commitToken` returned, `null` header
 * included, so no redundant Set-Cookie is emitted.
 */
export async function commitValidCsrfToken(
	request: Request
): Promise<readonly [string, null | string]> {
	const [token, setCookieHeader] = await csrfSession.commitToken(request)

	// A non-null header means `commitToken` just minted this token, so it is
	// valid by construction - and the cookie carrying it is not on the *inbound*
	// request yet, so probing would fail with `missing_token_in_cookie`.
	if (setCookieHeader !== null) {
		return [token, setCookieHeader] as const
	}

	try {
		// Throws unless the cookie's token signature verifies AND it matches the
		// token about to be handed to the page. Both sides come from the same
		// commit, so only the signature check can realistically fail here.
		await csrfSession.validate(buildCsrfCarrier(token), request.headers)
		return [token, setCookieHeader] as const
	} catch {
		// Deliberately catching everything rather than just `CSRFError`:
		// `verifySignature` decodes the signature as base64url, which *throws* on
		// malformed padding instead of returning false. Letting that escape would
		// 500 the root loader for exactly the visitors this heals.
		const freshToken = csrfSession.generate()
		return [freshToken, await cookie.serialize(freshToken)] as const
	}
}
