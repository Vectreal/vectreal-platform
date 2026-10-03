import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	buildSignedAssetUrl,
	createEmbedAssetUrls,
	signedAssetExpiry,
	verifySignedAsset
} from './embed-asset-signature.server'

const SECRET = 'test-signing-secret'
const target = { sceneId: 'scene-1', assetId: 'glb-1' }
const HOUR_MS = 3_600_000
const at = (iso: string) => new Date(iso).getTime()

/** Reads an emitted URL the way the asset route will. */
const searchOf = (url: string) => new URL(url, 'https://vectreal.test').search

const withParams = (
	search: string,
	edit: (params: URLSearchParams) => void
) => {
	const params = new URLSearchParams(search)
	edit(params)
	return `?${params}`
}

describe('signed embed asset URLs', () => {
	const issuedAt = at('2026-10-03T12:10:00Z')
	const url = buildSignedAssetUrl(target, SECRET, issuedAt)

	it('point at the asset route and carry no key', () => {
		expect(url.startsWith('/api/scenes/scene-1/assets/glb-1?')).toBe(true)
		expect(url).not.toMatch(/token|projectId|preview/)
	})

	it('are the same URL for every visitor in the same hour', () => {
		expect(
			buildSignedAssetUrl(target, SECRET, at('2026-10-03T12:59:59Z'))
		).toBe(url)
		expect(
			buildSignedAssetUrl(target, SECRET, at('2026-10-03T13:00:00Z'))
		).not.toBe(url)
	})

	it('stay valid for between one and two hours', () => {
		const expiry = signedAssetExpiry(issuedAt) * 1000
		expect(expiry - issuedAt).toBeGreaterThan(HOUR_MS)
		expect(expiry - issuedAt).toBeLessThanOrEqual(2 * HOUR_MS)
	})

	it('are accepted for the asset they were signed for', () => {
		const check = verifySignedAsset(target, searchOf(url), SECRET, issuedAt)
		expect(check).toEqual({ ok: true, secondsLeft: 6600 })
	})

	it('are refused once expired', () => {
		const later = signedAssetExpiry(issuedAt) * 1000
		expect(verifySignedAsset(target, searchOf(url), SECRET, later)).toEqual({
			ok: false,
			reason: 'expired'
		})
	})

	it('are refused for any other asset or scene', () => {
		const query = searchOf(url)
		expect(
			verifySignedAsset(
				{ ...target, assetId: 'bake-1' },
				query,
				SECRET,
				issuedAt
			)
		).toEqual({ ok: false, reason: 'invalid' })
		expect(
			verifySignedAsset(
				{ ...target, sceneId: 'scene-2' },
				query,
				SECRET,
				issuedAt
			)
		).toEqual({ ok: false, reason: 'invalid' })
	})

	it('are refused when the expiry is pushed back', () => {
		const extended = withParams(searchOf(url), (params) =>
			params.set('exp', String(Number(params.get('exp')) + 86_400))
		)
		expect(verifySignedAsset(target, extended, SECRET, issuedAt)).toEqual({
			ok: false,
			reason: 'invalid'
		})
	})

	it('are refused under another secret', () => {
		expect(
			verifySignedAsset(target, searchOf(url), 'other-secret', issuedAt)
		).toEqual({ ok: false, reason: 'invalid' })
	})

	it('refuse a request with no signature or no usable expiry', () => {
		const query = searchOf(url)
		const unsigned = withParams(query, (params) => params.delete('sig'))
		const undated = withParams(query, (params) => params.set('exp', 'soon'))
		expect(verifySignedAsset(target, unsigned, SECRET, issuedAt)).toEqual({
			ok: false,
			reason: 'malformed'
		})
		expect(verifySignedAsset(target, undated, SECRET, issuedAt)).toEqual({
			ok: false,
			reason: 'malformed'
		})
	})

	it('are accepted only in the spelling they were issued in', () => {
		const query = searchOf(url)
		const params = new URLSearchParams(query)
		const respellings = [
			`${query}&cachebust=1`,
			`?sig=${params.get('sig')}&exp=${params.get('exp')}`,
			`?exp=0${params.get('exp')}&sig=${params.get('sig')}`,
			`?exp=${params.get('exp')}&sig=${params.get('sig')}=`
		]
		for (const respelled of respellings) {
			expect(verifySignedAsset(target, respelled, SECRET, issuedAt)).toEqual({
				ok: false,
				reason: 'invalid'
			})
		}
	})
})

describe('the URLs an embed manifest hands out', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	const params = {
		sceneId: 'scene-1',
		projectId: 'project-1',
		token: 'vctrl_live',
		nowMs: at('2026-10-03T12:10:00Z')
	}

	it('are accepted by the asset route that will serve them', () => {
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', SECRET)
		const urls = createEmbedAssetUrls(params)
		const url = urls.buildAssetUrl('glb-1')

		expect(
			verifySignedAsset(target, searchOf(url), SECRET, params.nowMs)
		).toMatchObject({ ok: true })
	})

	it('change version at expiry and when the secret is rotated', () => {
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', SECRET)
		const { version } = createEmbedAssetUrls(params)
		const sameHour = createEmbedAssetUrls({
			...params,
			nowMs: params.nowMs + 60_000
		})
		const nextHour = createEmbedAssetUrls({
			...params,
			nowMs: params.nowMs + HOUR_MS
		})
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', 'rotated-secret')
		const rotated = createEmbedAssetUrls(params)

		expect(version).toMatch(
			new RegExp(`^${signedAssetExpiry(params.nowMs)}\\.`)
		)
		expect(version).not.toContain(SECRET)
		expect(sameHour.version).toBe(version)
		expect(nextHour.version).not.toBe(version)
		expect(rotated.version).not.toBe(version)
	})

	it('fall back to key-authenticated URLs without a secret', () => {
		vi.stubEnv('EMBED_ASSET_SIGNING_SECRET', '')
		const urls = createEmbedAssetUrls(params)

		expect(urls.buildAssetUrl('glb-1')).toBe(
			'/api/scenes/scene-1/assets/glb-1?preview=1&projectId=project-1&token=vctrl_live'
		)
		expect(urls.version).toBeNull()
	})
})
