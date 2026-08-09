import { createHash } from 'node:crypto'

import { CSRFError } from 'remix-utils/csrf/server'
import { describe, expect, it, vi } from 'vitest'

import {
	buildCsrfCarrier,
	commitValidCsrfToken,
	cookie,
	csrfSession
} from './csrf-session.server'

/**
 * Reproduce the token signature remix-utils v8.8 produced.
 *
 * v8 signed with an *unkeyed* `base64url(sha256(token))`; v10 signs with an
 * HMAC keyed by the CSRF secret. Because v8's variant took no secret, a legacy
 * token can be forged here without knowing this app's secret.
 *
 * `@oslojs/encoding` is an optional peer of remix-utils and pnpm does not hoist
 * it, so base64url is spelled out. The padding is deliberate: `encodeBase64url`
 * pads, and v10's `decodeBase64url` *requires* padding - an unpadded signature
 * throws `Invalid padding` rather than failing the signature comparison, which
 * is a different bug than the one that shipped.
 */
function signLikeRemixUtilsV8(value: string): string {
	return createHash('sha256')
		.update(value, 'utf8')
		.digest('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
}

const LEGACY_VALUE = 'PZ0ncPYaqQrHnHNJ1SsYJRJ4mLZgz3rXdrOKFYRIfMY'
const LEGACY_TOKEN = `${LEGACY_VALUE}.${signLikeRemixUtilsV8(LEGACY_VALUE)}`

/** Turn a `Set-Cookie` header into the `Cookie` header a browser sends back. */
function asRequestCookie(setCookieHeader: string): string {
	return setCookieHeader.split(';')[0]
}

function requestWithCookie(cookieHeader: string): Request {
	return new Request('https://vectreal.com/sign-in', {
		headers: { cookie: cookieHeader }
	})
}

async function requestCarrying(token: string): Promise<Request> {
	return requestWithCookie(asRequestCookie(await cookie.serialize(token)))
}

describe('legacy remix-utils v8 token (the shipped regression)', () => {
	it('still unsigns at the cookie layer, so the failure is not a null parse', async () => {
		const setCookieHeader = await cookie.serialize(LEGACY_TOKEN)

		// The cookie's own signature layer uses the same secret before and after
		// the upgrade, so it is unaffected - which is exactly why the stale token
		// survives long enough to reach `verifySignature`.
		await expect(cookie.parse(asRequestCookie(setCookieHeader))).resolves.toBe(
			LEGACY_TOKEN
		)
	})

	it('is echoed back by commitToken with no Set-Cookie, so it never heals', async () => {
		const request = await requestCarrying(LEGACY_TOKEN)

		const [token, setCookieHeader] = await csrfSession.commitToken(request)

		expect(token).toBe(LEGACY_TOKEN)
		expect(setCookieHeader).toBeNull()
	})

	it('fails validation with tampered_token_in_cookie', async () => {
		const request = await requestCarrying(LEGACY_TOKEN)

		const error = await csrfSession
			.validate(buildCsrfCarrier(LEGACY_TOKEN), request.headers)
			.then(
				() => null,
				(caught: unknown) => caught
			)

		expect(error).toBeInstanceOf(CSRFError)
		expect((error as CSRFError).code).toBe('tampered_token_in_cookie')
	})
})

describe('commitValidCsrfToken', () => {
	it('re-mints a stale v8 token and returns one that validates', async () => {
		const request = await requestCarrying(LEGACY_TOKEN)

		const [token, setCookieHeader] = await commitValidCsrfToken(request)

		expect(token).not.toBe(LEGACY_TOKEN)
		expect(setCookieHeader).not.toBeNull()

		// The visitor is unstuck on their very next request: replay the emitted
		// cookie the way a browser would, and the token now validates.
		const nextRequest = requestWithCookie(
			asRequestCookie(setCookieHeader as string)
		)

		await expect(
			csrfSession.validate(buildCsrfCarrier(token), nextRequest.headers)
		).resolves.toBeUndefined()
	})

	it('overwrites the csrf cookie in place rather than orphaning it', async () => {
		const request = await requestCarrying(LEGACY_TOKEN)

		const [, setCookieHeader] = await commitValidCsrfToken(request)

		expect(setCookieHeader).toMatch(/^csrf=/)
		expect(setCookieHeader).toContain('Path=/')
		expect(setCookieHeader).toContain('HttpOnly')
	})

	it('is a no-op for a healthy cookie - same token, still no Set-Cookie', async () => {
		const healthyToken = csrfSession.generate()
		const request = await requestCarrying(healthyToken)

		const [token, setCookieHeader] = await commitValidCsrfToken(request)

		// Emitting a redundant Set-Cookie here would be a caching regression.
		expect(token).toBe(healthyToken)
		expect(setCookieHeader).toBeNull()
	})

	it('mints exactly once for a first-time visitor with no csrf cookie', async () => {
		const request = new Request('https://vectreal.com/sign-in')

		// The probe has to be skipped on this path: the freshly minted cookie is
		// not on the *inbound* request, so validating against it would throw
		// `missing_token_in_cookie` and mint a second time. Counting mints is what
		// pins that down - the assertions below pass either way.
		const generate = vi.spyOn(csrfSession, 'generate')

		const [token, setCookieHeader] = await commitValidCsrfToken(request)

		expect(generate).toHaveBeenCalledTimes(1)
		expect(setCookieHeader).not.toBeNull()

		const nextRequest = requestWithCookie(
			asRequestCookie(setCookieHeader as string)
		)

		await expect(
			csrfSession.validate(buildCsrfCarrier(token), nextRequest.headers)
		).resolves.toBeUndefined()

		generate.mockRestore()
	})

	it('heals a cookie whose payload is not a string', async () => {
		// React Router's `decodeData` returns `{}` for a malformed payload, and
		// `commitToken` treats that truthy non-string as "cookie already set" while
		// refusing to reuse it as a token - a fresh token with no matching cookie,
		// i.e. permanent `mismatched_token`.
		const corrupted = await cookie.serialize({ notAToken: true })
		const request = requestWithCookie(asRequestCookie(corrupted))

		const [token, setCookieHeader] = await commitValidCsrfToken(request)

		expect(setCookieHeader).not.toBeNull()

		const nextRequest = requestWithCookie(
			asRequestCookie(setCookieHeader as string)
		)

		await expect(
			csrfSession.validate(buildCsrfCarrier(token), nextRequest.headers)
		).resolves.toBeUndefined()
	})
})
