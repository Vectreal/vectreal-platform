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
 * The cost is revocation lag. A URL works for anyone holding it until it
 * expires, two hours at most, and nothing checked when it was issued is checked
 * again: a revoked key, a narrowed domain list, an unpublished or deleted
 * scene all stop new URLs at once and leave the issued ones working.
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

function signedQuery(
	target: SignedAssetTarget,
	expiry: number,
	secret: string
): string {
	return new URLSearchParams({
		exp: String(expiry),
		sig: signature(target, expiry, secret).toString('base64url')
	}).toString()
}

/**
 * Identifies the secret without revealing it, so URLs signed under a rotated
 * secret read as a different version.
 */
function secretFingerprint(secret: string): string {
	return createHmac('sha256', secret)
		.update('embed-asset-url-version')
		.digest('base64url')
		.slice(0, 8)
}

const signedAssetPath = ({ sceneId, assetId }: SignedAssetTarget) =>
	`/api/scenes/${sceneId}/assets/${assetId}`

export function buildSignedAssetUrl(
	target: SignedAssetTarget,
	secret: string,
	nowMs: number
): string {
	const query = signedQuery(target, signedAssetExpiry(nowMs), secret)
	return `${signedAssetPath(target)}?${query}`
}

/**
 * Accepts only the exact URL `buildSignedAssetUrl` wrote. The edge caches by
 * the full URL, so any other spelling of a valid signature (an added
 * parameter, a reordered one, a padded number, an encoded space or a trailing
 * slash on the path) would be a fresh cache key, and a way to send every
 * request to the origin.
 */
export function verifySignedAsset(
	target: SignedAssetTarget,
	{ pathname, search }: { pathname: string; search: string },
	secret: string,
	nowMs: number
): SignedAssetCheck {
	if (pathname !== signedAssetPath(target)) {
		return { ok: false, reason: 'invalid' }
	}
	const query = new URLSearchParams(search)
	const exp = query.get('exp')
	const expiry = Number(exp)
	if (!exp || !query.get('sig') || !Number.isSafeInteger(expiry)) {
		return { ok: false, reason: 'malformed' }
	}

	const expected = Buffer.from(signedQuery(target, expiry, secret))
	const given = Buffer.from(search.replace(/^\?/, ''))
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
	 * Changes whenever URLs built now would differ from earlier ones: at expiry,
	 * and when the secret is rotated. Null for URLs that never change. A
	 * manifest revalidated by ETag folds this into its tag, or a 304 would keep
	 * URLs alive in the browser that no longer work.
	 */
	version: string | null
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
			version: `${signedAssetExpiry(nowMs)}.${secretFingerprint(secret)}`
		}
	}

	return {
		buildAssetUrl: (assetId) => {
			const query = new URLSearchParams({ preview: '1', projectId })
			if (token) query.set('token', token)
			return `/api/scenes/${sceneId}/assets/${assetId}?${query}`
		},
		version: null
	}
}
