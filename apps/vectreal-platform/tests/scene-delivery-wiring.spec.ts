/**
 * Scene delivery wiring that no behavioural test can reach.
 *
 * Each guard here sits in a `.server.ts` module or a route, both of which call
 * `getDbClient()` at import and so cannot be loaded by a spec. The rules they
 * call are tested beside the rules; these assertions prove the rules are
 * called. Renaming a call is meant to fail this - re-point the guard rather
 * than deleting it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (path: string) =>
	readFileSync(join(import.meta.dirname, '..', 'app', path), 'utf8')

describe('embed key use', () => {
	const auth = read('lib/domain/auth/preview-api-key-auth.server.ts')

	it('writes lastUsedAt only when the stored value has gone stale', () => {
		expect(auth).toMatch(
			/if \(hashedToken && shouldRecordKeyUse\(match\?\.lastUsedAt \?\? null, now\)\) \{\s*await db\s*\.update\(apiKeys\)/
		)
	})
})

describe('the embed manifest ETag', () => {
	const route = read('routes/api/scenes.$sceneId.ts')

	it("is keyed on the publication and its URLs' expiry", () => {
		expect(route).toMatch(
			/\{\s*assetId: previewScene\.publishedAssetId,\s*publishedAt: previewScene\.publishedAt,\s*assetUrlsExpireAt: embedAssetUrls\.expiresAt\s*\}/
		)
		expect(route).toMatch(
			/buildSceneManifestEtag\(\s*sceneId,\s*manifest\.settingsUpdatedAt,\s*publication\s*\)/
		)
	})

	it('signs asset URLs for an embed manifest only', () => {
		expect(route).toMatch(
			/const embedAssetUrls = previewScene\s*\?\s*createEmbedAssetUrls\(/
		)
	})
})

describe('the embed asset route', () => {
	const route = read('routes/api/scenes.$sceneId.assets.$assetId.ts')

	it('serves the published GLB before reading any settings', () => {
		const fastPath = route.indexOf(
			'if (assetId === previewScene.publishedAssetId && filePath && name) {'
		)
		expect(fastPath).toBeGreaterThan(
			route.indexOf('await getPublishedScenePreview(projectId, sceneId)')
		)
		expect(fastPath).toBeLessThan(
			route.indexOf('sceneSettingsService.getSceneSettingsWithAssetRefs')
		)
		expect(route.slice(fastPath)).toMatch(
			/^[\s\S]{0,300}?downloadAssetFromRow\(\{ id: assetId, filePath, mimeType, name \}\)/
		)
	})
})

describe('the Draco decoder', () => {
	const server = readFileSync(
		join(import.meta.dirname, '..', 'server.mjs'),
		'utf8'
	)

	it('is cached for a day, ahead of the uncached static fallback', () => {
		const draco = server.indexOf("app.use(\n\t'/draco',")
		expect(draco).toBeGreaterThan(-1)
		expect(server.slice(draco)).toMatch(/^[\s\S]{0,200}?maxAge: '1d'/)
		expect(draco).toBeLessThan(
			server.indexOf('app.use(express.static(CLIENT_DIR, { redirect: false }))')
		)
	})
})

describe('signed embed assets', () => {
	const route = read('routes/api/scenes.$sceneId.assets.$assetId.ts')

	it('are answered before any key or session lookup', () => {
		const signed = route.indexOf("if (url.searchParams.has('sig')) {")
		expect(signed).toBeGreaterThan(-1)
		expect(signed).toBeLessThan(
			route.indexOf('await validatePreviewApiKeyForProject(')
		)
		expect(signed).toBeLessThan(route.indexOf('await getAuthUser(request)'))
	})

	it('are verified before anything is downloaded', () => {
		const handler = route.slice(
			route.indexOf('async function serveSignedAsset(')
		)
		expect(handler.indexOf('verifySignedAsset(')).toBeGreaterThan(-1)
		expect(handler.indexOf('if (!check?.ok) {')).toBeGreaterThan(-1)
		expect(handler.indexOf('if (!check?.ok) {')).toBeLessThan(
			handler.indexOf('await downloadAsset(')
		)
	})

	it('are publicly cacheable for exactly as long as they stay valid', () => {
		expect(route).toContain(
			'`public, max-age=${check.secondsLeft}, s-maxage=${check.secondsLeft}`'
		)
	})
})

describe('the published GLB upload', () => {
	const operations = read(
		'lib/domain/scene/server/scene-settings.operations.server.ts'
	)
	const preview = read(
		'lib/domain/scene/server/scene-preview-repository.server.ts'
	)

	it('records the extensions the GLB declares', () => {
		const upload = operations.slice(
			operations.indexOf('export async function uploadPublishedGlb(')
		)
		expect(upload).toMatch(
			/^[\s\S]{0,1500}?metadata: \{ gltfExtensionsUsed: readGlbExtensionsUsed\(bytes\) \}/
		)
	})

	it('hands those extensions to the manifest', () => {
		expect(preview).toContain('publishedAssetMetadata: assets.metadata')
		expect(preview).toContain(
			'extensionsUsed: extensionsUsedFromMetadata(preview.publishedAssetMetadata)'
		)
	})
})
