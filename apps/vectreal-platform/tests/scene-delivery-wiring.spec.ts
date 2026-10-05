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
			/\{\s*assetId: previewScene\.publishedAssetId,\s*publishedAt: previewScene\.publishedAt,\s*assetUrlsVersion: embedAssetUrls\.version\s*\}/
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

describe('the codec files: Draco decoder, KTX2 transcoder and encoder', () => {
	const server = readFileSync(
		join(import.meta.dirname, '..', 'server.mjs'),
		'utf8'
	)

	it('are cached for a day, ahead of the uncached static fallback', () => {
		const mount = server.match(
			/for \(const codecDir of (\[[^\]]*\])\) \{\n\tapp\.use\(\n\t\t`\/\$\{codecDir\}`,\n\t\texpress\.static\(path\.join\(CLIENT_DIR, codecDir\), \{\n\t\t\tmaxAge: '1d',/
		)
		expect(mount).not.toBeNull()
		expect(JSON.parse(mount![1].replaceAll("'", '"'))).toEqual([
			'draco',
			'basis',
			'basis-encoder'
		])
		expect(mount!.index).toBeLessThan(
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

	it('verify the whole query the route received', () => {
		expect(route).toContain(
			'return serveSignedAsset(request, { sceneId, assetId }, url)'
		)
	})

	it('answer an asset deleted by a republish with a quiet 404', () => {
		const handler = route.slice(
			route.indexOf('async function serveSignedAsset('),
			route.indexOf('export async function loader(')
		)
		const notFound = handler.indexOf(
			'if (error instanceof AssetNotFoundError) {'
		)
		expect(notFound).toBeGreaterThan(-1)
		expect(notFound).toBeLessThan(handler.indexOf('reportServerError('))
		expect(handler.slice(notFound)).toMatch(/^[^}]*status: 404/)
		expect(read('lib/domain/asset/asset-storage.server.ts')).toMatch(
			/if \(!asset\) \{\s*throw new AssetNotFoundError\(assetId\)/
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

describe('the /embed document', () => {
	const layout = read('routes/layouts/embed-layout.tsx')
	const route = read('routes/embed-page/embed-scene.tsx')

	it('reads the publication, settings and branding together', () => {
		expect(layout).toMatch(
			/await Promise\.all\(\[\s*getPublishedScenePreview\(projectId, sceneId\),\s*readEmbedSceneSettings\(sceneId\)/
		)
	})

	it('builds the inline manifest with the same asset URLs the API hands out', () => {
		const builder = layout.slice(
			layout.indexOf('async function buildInlineEmbedManifest(')
		)
		expect(builder).toMatch(
			/^[\s\S]{0,1200}?createEmbedAssetUrls\(\{ sceneId, projectId, token \}\)/
		)
		expect(builder).toMatch(
			/^[\s\S]{0,2000}?composeEmbedSceneManifest\(\s*sceneId,\s*toPublishedModelRow\(previewScene\),\s*settingsData,\s*assetUrls\.buildAssetUrl\s*\)/
		)
	})

	it('hands the manifest to the page', () => {
		expect(layout).toContain('manifest: loaderData.manifest as')
		expect(route).toContain('initialManifest={manifest}')
	})
})

describe('the /embed document head', () => {
	it('carries the preloads for the manifest it serves', () => {
		expect(read('routes/embed-page/embed-scene.tsx')).toContain(
			'{manifest && <EmbedResourceHints manifest={manifest} />}'
		)
	})
})

describe('the loading thumbnail', () => {
	it('is servable to an embed only where its author showed it', () => {
		expect(read('lib/domain/scene/server/scene-manifest.server.ts')).toContain(
			'showsLoadingThumbnail: shouldShowLoadingThumbnail(settings?.presentation)'
		)
		expect(read('routes/api/scenes.$sceneId.assets.$assetId.ts')).toMatch(
			/showsLoadingThumbnail: shouldShowLoadingThumbnail\(\s*settingsData\?\.settings\?\.presentation\s*\)/
		)
	})
})
