import { describe, expect, it } from 'vitest'

import {
	decideEmbedAccess,
	getPreviewTokenFromRequest,
	isEmbedRequestHostAllowed,
	resolveRequestHostContext,
	type EmbedKeyMatch
} from './embed-access-policy'

/**
 * The decision that lets a third-party page load a published scene.
 *
 * Until this module was split out of `preview-api-key-auth.server.ts` none of it
 * could be tested: that file calls `getDbClient()` at module scope, so importing
 * it threw `Missing DATABASE_URL`. The rule guarding every embed on every
 * customer site had no test, and the two production failures on this path were
 * both found by a customer rather than by CI.
 *
 * The cases below are written against the allowlist string as an owner actually
 * saves it, so they exercise the join between this module and
 * `embed-domain-policy` rather than a hand-built pattern array. That seam is
 * where the wildcard bug lived.
 */

const ORG = 'org-1'
const OTHER_ORG = 'org-2'

function keyMatch(overrides: Partial<EmbedKeyMatch> = {}): EmbedKeyMatch {
	return {
		apiKeyId: 'key-1',
		projectId: 'project-1',
		userId: 'user-1',
		apiKeyOrganizationId: ORG,
		projectOrganizationId: ORG,
		allowedEmbedDomains: 'store.example.com',
		...overrides
	}
}

function embedRequest({
	appHost = 'vectreal.com',
	token = 'vctrl_live',
	referer,
	origin,
	authorization
}: {
	appHost?: string
	token?: string | null
	referer?: string
	origin?: string
	authorization?: string
} = {}): Request {
	const url = new URL(`https://${appHost}/embed/project-1/scene-1`)
	if (token) url.searchParams.set('token', token)

	const headers = new Headers()
	if (referer) headers.set('referer', referer)
	if (origin) headers.set('origin', origin)
	if (authorization) headers.set('authorization', authorization)

	return new Request(url, { headers })
}

describe('getPreviewTokenFromRequest', () => {
	it('reads the query parameter', () => {
		expect(getPreviewTokenFromRequest(embedRequest({ token: 'abc' }))).toBe(
			'abc'
		)
	})

	it('falls back to a bearer header', () => {
		const request = embedRequest({ token: null, authorization: 'Bearer abc' })
		expect(getPreviewTokenFromRequest(request)).toBe('abc')
	})

	it.each([
		['a non-bearer scheme', 'Basic abc'],
		['a scheme with no token', 'Bearer'],
		['an empty token', 'Bearer    ']
	])('returns null for %s', (_label, authorization) => {
		const request = embedRequest({ token: null, authorization })
		expect(getPreviewTokenFromRequest(request)).toBeNull()
	})

	it('returns null when neither is present', () => {
		expect(getPreviewTokenFromRequest(embedRequest({ token: null }))).toBeNull()
	})
})

describe('resolveRequestHostContext', () => {
	it('prefers referer over origin', () => {
		const request = embedRequest({
			referer: 'https://store.example.com/products/1',
			origin: 'https://other.example.com'
		})
		expect(resolveRequestHostContext(request)).toEqual({
			host: 'store.example.com',
			source: 'referer'
		})
	})

	it('uses origin when referer is absent', () => {
		const request = embedRequest({ origin: 'https://store.example.com' })
		expect(resolveRequestHostContext(request)).toEqual({
			host: 'store.example.com',
			source: 'origin'
		})
	})

	it('reports missing when a page sends neither', () => {
		expect(resolveRequestHostContext(embedRequest())).toEqual({
			host: null,
			source: 'missing'
		})
	})
})

describe('isEmbedRequestHostAllowed', () => {
	it('allows a host the owner saved', () => {
		expect(
			isEmbedRequestHostAllowed({
				request: embedRequest({ referer: 'https://store.example.com/p/1' }),
				allowedEmbedDomains: 'store.example.com'
			})
		).toBe(true)
	})

	it('refuses a host the owner did not save', () => {
		expect(
			isEmbedRequestHostAllowed({
				request: embedRequest({ referer: 'https://evil.example.com/' }),
				allowedEmbedDomains: 'store.example.com'
			})
		).toBe(false)
	})

	/*
	  The join with embed-domain-policy. A wildcard has to survive being stored
	  as text and read back before it can allow anything, which is exactly what
	  was broken: the matcher understood `*.myshopify.com` and nothing could save
	  one.
	*/
	it('allows a storefront under a saved wildcard', () => {
		expect(
			isEmbedRequestHostAllowed({
				request: embedRequest({
					referer: 'https://my-store.myshopify.com/products/shoe'
				}),
				allowedEmbedDomains: '*.myshopify.com'
			})
		).toBe(true)
	})

	it('refuses a lookalike of a saved wildcard', () => {
		expect(
			isEmbedRequestHostAllowed({
				request: embedRequest({ referer: 'https://evilmyshopify.com/' }),
				allowedEmbedDomains: '*.myshopify.com'
			})
		).toBe(false)
	})

	it('refuses every third-party host when the allowlist is empty', () => {
		expect(
			isEmbedRequestHostAllowed({
				request: embedRequest({ referer: 'https://store.example.com/' }),
				allowedEmbedDomains: null
			})
		).toBe(false)
	})

	/*
	  Why "Test embed URL" in the publisher cannot check a customer's allowlist:
	  a request from Vectreal itself matches the application host and is allowed
	  whatever the project says.
	*/
	it('allows a request from the application host itself, even with no allowlist', () => {
		expect(
			isEmbedRequestHostAllowed({
				request: embedRequest({
					appHost: 'vectreal.com',
					referer: 'https://vectreal.com/publisher/scene-1'
				}),
				allowedEmbedDomains: null
			})
		).toBe(true)
	})

	/*
	  The `noreferrer` trap. Opening the embed URL with 'noopener,noreferrer'
	  strips Referer, and in production that is refused - so the button that was
	  meant to prove the embed works reports it as broken.
	*/
	it('refuses a request with no referer or origin in production', () => {
		expect(
			isEmbedRequestHostAllowed({
				request: embedRequest({ appHost: 'vectreal.com' }),
				allowedEmbedDomains: 'store.example.com'
			})
		).toBe(false)
	})

	it('allows the same request against a localhost application host', () => {
		expect(
			isEmbedRequestHostAllowed({
				request: embedRequest({ appHost: 'localhost' }),
				allowedEmbedDomains: 'store.example.com'
			})
		).toBe(true)
	})
})

describe('decideEmbedAccess', () => {
	it('reports missing_token when no token was sent', () => {
		expect(
			decideEmbedAccess({
				request: embedRequest({ token: null }),
				token: null,
				match: keyMatch()
			})
		).toEqual({ ok: false, error: 'missing_token' })
	})

	it('reports invalid_token when no live key matched', () => {
		expect(
			decideEmbedAccess({
				request: embedRequest(),
				token: 'vctrl_live',
				match: null
			})
		).toEqual({ ok: false, error: 'invalid_token' })
	})

	/*
	  A real key pointed at another organization's project must be
	  indistinguishable from a fake one. A distinct code would confirm the token
	  is genuine, which is an oracle worth walking.
	*/
	it('reports invalid_token, not a distinct code, when the key belongs to another organization', () => {
		expect(
			decideEmbedAccess({
				request: embedRequest({ referer: 'https://store.example.com/' }),
				token: 'vctrl_live',
				match: keyMatch({ apiKeyOrganizationId: OTHER_ORG })
			})
		).toEqual({ ok: false, error: 'invalid_token' })
	})

	it('reports domain_not_allowed for a live key on an unlisted site', () => {
		expect(
			decideEmbedAccess({
				request: embedRequest({ referer: 'https://evil.example.com/' }),
				token: 'vctrl_live',
				match: keyMatch()
			})
		).toEqual({ ok: false, error: 'domain_not_allowed' })
	})

	/*
	  `organizationId` is the project's owner, not the key's. They are required
	  to match above, so the value is the same - but what a caller wants it for
	  is "whose plan governs this embed", and that is a property of the scene.
	*/
	it('returns the key identity on success', () => {
		expect(
			decideEmbedAccess({
				request: embedRequest({ referer: 'https://store.example.com/p/1' }),
				token: 'vctrl_live',
				match: keyMatch()
			})
		).toEqual({
			ok: true,
			apiKeyId: 'key-1',
			projectId: 'project-1',
			userId: 'user-1',
			organizationId: ORG
		})
	})

	it('lets a Shopify storefront through end to end', () => {
		expect(
			decideEmbedAccess({
				request: embedRequest({
					referer: 'https://my-store.myshopify.com/products/shoe'
				}),
				token: 'vctrl_live',
				match: keyMatch({ allowedEmbedDomains: '*.myshopify.com' })
			})
		).toEqual({
			ok: true,
			apiKeyId: 'key-1',
			projectId: 'project-1',
			userId: 'user-1',
			organizationId: ORG
		})
	})
})
