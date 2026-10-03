import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signed URLs for the assets an embed manifest references.
 *
 * An embed's assets used to be fetched with the API key in the URL, so every
 * request re-ran the key lookup and the scene checks, and no cache could hold
 * the response: it was `private`, and its URL differed per key. A signed URL
 * moves that authorization to the moment the manifest is built. The manifest
 * request proves the key; the URL it hands out proves the manifest.
 *
 * The URL carries no key and expires on an hour boundary, so every visitor of a
 * scene in the same hour asks for the same URL, and Cloudflare can serve it.
 * The cost is revocation lag: a revoked key stops getting new URLs at once, and
 * the ones already handed out keep working until they expire, two hours at most.
 */

const SIGNING_SECRET_ENV = 'EMBED_ASSET_SIGNING_SECRET'
const WINDOW_SECONDS = 3600

export interface SignedAssetTarget {
	sceneId: string
	assetId: string
}

export type SignedAssetCheck =
	| { ok: true; secondsLeft: number }
	| { ok: false; reason: 'malformed' | 'expired' | 'invalid' }

/** Null when unset: callers then hand out today's key-authenticated URLs. */
export function getAssetSigningSecret(): string | null {
	return process.env[SIGNING_SECRET_ENV]?.trim() || null
}

/**
 * The end of the next hour, in epoch seconds. Shared by every request in the
 * current hour, and never less than an hour away.
 */
export function signedAssetExpiry(nowMs: number): number {
	return (Math.floor(nowMs / 1000 / WINDOW_SECONDS) + 2) * WINDOW_SECONDS
}

function signature(
	{ sceneId, assetId }: SignedAssetTarget,
	expiry: number,
	secret: string
): Buffer {
	return createHmac('sha256', secret)
		.update(`${sceneId}|${assetId}|${expiry}`)
		.digest()
}

export function buildSignedAssetUrl(
	target: SignedAssetTarget,
	secret: string,
	nowMs: number
): string {
	const expiry = signedAssetExpiry(nowMs)
	const params = new URLSearchParams({
		exp: String(expiry),
		sig: signature(target, expiry, secret).toString('base64url')
	})
	return `/api/scenes/${target.sceneId}/assets/${target.assetId}?${params}`
}

export function verifySignedAsset(
	target: SignedAssetTarget,
	query: { exp: string | null; sig: string | null },
	secret: string,
	nowMs: number
): SignedAssetCheck {
	const expiry = Number(query.exp)
	if (!query.sig || !Number.isSafeInteger(expiry)) {
		return { ok: false, reason: 'malformed' }
	}

	const expected = signature(target, expiry, secret)
	const given = Buffer.from(query.sig, 'base64url')
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
		return { ok: false, reason: 'invalid' }
	}

	const secondsLeft = expiry - Math.floor(nowMs / 1000)
	if (secondsLeft <= 0) return { ok: false, reason: 'expired' }

	return { ok: true, secondsLeft }
}

export interface EmbedAssetUrls {
	buildAssetUrl: (assetId: string) => string
	/**
	 * When the URLs stop working, in epoch seconds, or null for URLs that do
	 * not expire. A manifest that is revalidated by ETag has to fold this into
	 * its tag, or a 304 would keep URLs alive in the browser past their expiry.
	 */
	expiresAt: number | null
}

/**
 * How an embed manifest addresses its assets: signed when a secret is
 * configured, and otherwise the key-authenticated URL the asset route has
 * always accepted.
 */
export function createEmbedAssetUrls(params: {
	sceneId: string
	projectId: string
	token: string | null
	nowMs?: number
}): EmbedAssetUrls {
	const { sceneId, projectId, token, nowMs = Date.now() } = params
	const secret = getAssetSigningSecret()

	if (secret) {
		return {
			buildAssetUrl: (assetId) =>
				buildSignedAssetUrl({ sceneId, assetId }, secret, nowMs),
			expiresAt: signedAssetExpiry(nowMs)
		}
	}

	return {
		buildAssetUrl: (assetId) => {
			const query = new URLSearchParams({ preview: '1', projectId })
			if (token) query.set('token', token)
			return `/api/scenes/${sceneId}/assets/${assetId}?${query}`
		},
		expiresAt: null
	}
}
