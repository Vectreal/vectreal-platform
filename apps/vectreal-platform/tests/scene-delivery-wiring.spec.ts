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

	it("is keyed on the publication, its URLs' expiry and the caller", () => {
		expect(route).toMatch(
			/\{\s*assetId: previewScene\.publishedAssetId,\s*publishedAt: previewScene\.publishedAt,\s*assetUrlsVersion: embedAssetUrls\.version,\s*caller: authContext\.mode\s*\}/
		)
		expect(route).toMatch(
			/buildSceneManifestEtag\(\s*sceneId,\s*manifest\.settingsUpdatedAt,\s*publication\s*\)/
		)
	})

	it('signs asset URLs for an embed manifest only', () => {
		expect(route).toMatch(
			/const embedAssetUrls = publishedModelRow\s*\?\s*createEmbedAssetUrls\(/
		)
	})

	it('hands a member no token, only a key holder their own', () => {
		expect(route).toMatch(
			/token:\s*authContext\.mode === 'apiKey'\s*\?\s*url\.searchParams\.get\('token'\)\?\.trim\(\) \|\| null\s*:\s*null/
		)
	})
})

describe('the embed asset route', () => {
	const route = read('routes/api/scenes.$sceneId.assets.$assetId.ts')

	it('serves the published GLB before reading any settings', () => {
		const fastPath = route.indexOf(
			'const publishedModel = serveFromPublishedRow('
		)
		expect(fastPath).toBeGreaterThan(
			route.indexOf('await getPublishedScenePreview(projectId, sceneId)')
		)
		expect(fastPath).toBeLessThan(
			route.indexOf('sceneSettingsService.getSceneSettingsWithAssetRefs')
		)
		expect(route.slice(fastPath)).toMatch(
			/^[^)]*previewScene\s*\)\s*if \(publishedModel\) return publishedModel/
		)
	})

	it('downloads the published GLB from the row the query joined', () => {
		const helper = route.slice(route.indexOf('function serveFromPublishedRow('))
		expect(helper).toMatch(
			/^[\s\S]{0,400}?if \(!previewScene \|\| ids\.assetId !== previewScene\.publishedAssetId\) \{\s*return null/
		)
		expect(helper).toMatch(
			/^[\s\S]{0,900}?downloadAssetFromRow\(\{ id: ids\.assetId, filePath, mimeType, name \}\)/
		)
	})
})

describe('the session asset branch', () => {
	const route = read('routes/api/scenes.$sceneId.assets.$assetId.ts')
	const session = route.slice(route.indexOf('// Session branch:'))

	it('gates on membership before it looks anything up', () => {
		const gate = session.indexOf(
			'await resolveSceneMembership(sceneId, auth.user.id)'
		)
		expect(gate).toBeGreaterThan(-1)
		expect(session.slice(gate)).toMatch(
			/^[^}]*if \(!membership\) \{\s*return new Response\('Asset not found', \{\s*status: 404/
		)
		expect(gate).toBeLessThan(session.indexOf('getPublishedScenePreview('))
		expect(gate).toBeLessThan(session.indexOf('assetBelongsToScene('))
		expect(session).not.toContain('getScene(')
	})

	it("serves the scene's linked assets or its published GLB, nothing else", () => {
		expect(session).toContain(
			'getPublishedScenePreview(membership.projectId, sceneId)'
		)
		const published = session.indexOf('serveFromPublishedRow(')
		const linked = session.indexOf('if (!isLinked) {')
		expect(published).toBeGreaterThan(-1)
		expect(linked).toBeGreaterThan(published)
		expect(linked).toBeLessThan(session.indexOf('await downloadAsset(assetId)'))
		expect(session).not.toContain('isEmbedServableAssetId')
		expect(session).not.toContain('selectEmbedServableAssets')
	})
})

describe('the session manifest branch', () => {
	const route = read('routes/api/scenes.$sceneId.ts')
	const preview = route.slice(
		route.indexOf('if (isPreviewRequest) {'),
		route.indexOf('const authResult = await getAuthUser(request)')
	)

	it('gates a member on membership of this scene, in this project', () => {
		const gate = preview.indexOf('await resolveSceneMembership(')
		expect(gate).toBeGreaterThan(-1)
		expect(preview.slice(gate)).toMatch(
			/^[^}]*if \(!membership \|\| membership\.projectId !== previewProjectId\) \{\s*return withNoStoreHeaders\(ApiResponse\.notFound/
		)
		expect(gate).toBeLessThan(preview.indexOf('getPublishedScenePreview('))
		expect(preview).not.toContain('getScene(')
	})

	it('looks up the publication for every caller and lets one rule choose', () => {
		expect(preview).toMatch(
			/const previewScene = await getPublishedScenePreview\(\s*previewProjectId,\s*sceneId\s*\)\s*const manifestKind = chooseSceneManifestKind\(\{\s*hasPublication: previewScene !== null,\s*caller: authContext\.mode\s*\}\)/
		)
		expect(preview).toMatch(
			/const publishedModelRow =\s*manifestKind === 'embed' && previewScene/
		)
	})

	it('refuses a key holder a draft before any manifest is built', () => {
		const refusal = preview.indexOf("if (manifestKind === 'not-found') {")
		expect(refusal).toBeGreaterThan(-1)
		expect(preview.slice(refusal)).toMatch(
			/^if \(manifestKind === 'not-found'\) \{\s*return withNoStoreHeaders\(ApiResponse\.notFound\('Scene not found'\)\)/
		)
		expect(refusal).toBeLessThan(preview.indexOf('await buildSceneManifest('))
	})
})

describe('the presentation action', () => {
	const route = read('routes/api/scenes.$sceneId.ts')
	const block = route.slice(
		route.indexOf("if (action === 'update-scene-presentation') {"),
		route.indexOf('const uploadOrPrepareAction =')
	)

	it('checks CSRF, then membership, then permission, then parses, then writes', () => {
		const order = [
			'await ensureValidCsrfToken(request, actionRequest.csrf)',
			'await resolveSceneMembership(',
			"canPerformDashboardOperation('scene:update', membership)",
			'normalizePresentationSettings(',
			'await updateScenePresentation('
		].map((step) => block.indexOf(step))

		expect(order.every((index) => index > -1)).toBe(true)
		expect([...order].sort((a, b) => a - b)).toEqual(order)
	})

	it('refuses a body with nothing it understands as a 400', () => {
		expect(block).toMatch(
			/if \(!presentation\) \{\s*return withAdditionalHeaders\(\s*ApiResponse\.badRequest\('Presentation settings are required'\)/
		)
	})

	it('writes under the scene write lock, and a scene with no settings row is a 404', () => {
		expect(block).toMatch(
			/await runWithSceneWriteLock\(\s*routeSceneId,\s*`[^`]*`,\s*async \(\) => \{\s*const updated = await updateScenePresentation\(/
		)
		expect(block).toMatch(
			/return updated\s*\?\s*ApiResponse\.success\(\{ presentation: updated \}\)\s*:\s*ApiResponse\.notFound\('Scene not found'\)/
		)
	})

	it('answers a non-member and a non-editor with the same 404', () => {
		expect(block).toMatch(
			/!membership \|\|\s*!canPerformDashboardOperation\('scene:update', membership\)\s*\) \{\s*return withAdditionalHeaders\(\s*ApiResponse\.notFound/
		)
		expect(block).not.toContain('assertDashboardPermission')
	})

	it('runs before the save parser, which would drop the field', () => {
		expect(
			route.indexOf("if (action === 'update-scene-presentation') {")
		).toBeLessThan(
			route.indexOf(
				': SceneSettingsParser.parseSceneSettingsRequestData(actionRequest)'
			)
		)
	})
})

describe('the presentation write', () => {
	const repository = read(
		'lib/domain/scene/server/scene-settings-repository.server.ts'
	)
	const write = repository.slice(
		repository.indexOf('export async function updateScenePresentation(')
	)

	it('merges into the stored JSON in one statement and moves the ETag', () => {
		expect(write).toMatch(
			/^[\s\S]{0,700}?\(coalesce\(\$\{sceneSettings\.presentation\}::jsonb, '\{\}'::jsonb\) \|\| \$\{JSON\.stringify\(patch\)\}::jsonb\)::json/
		)
		expect(write).toMatch(/^[\s\S]{0,800}?updatedAt: sql`now\(\)`/)
		expect(write).toMatch(
			/^[\s\S]{0,900}?\.where\(eq\(sceneSettings\.sceneId, sceneId\)\)/
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
		const builder = read('lib/domain/embed/inline-embed-manifest.server.ts')
		expect(builder).toContain(
			'createEmbedAssetUrls({ sceneId, projectId, token })'
		)
		expect(builder).toMatch(
			/if \(assetUrls\.version === null && !token && !allowUnsignedWithoutToken\) \{\s*return null/
		)
		expect(builder).toMatch(
			/composeEmbedSceneManifest\(\s*sceneId,\s*toPublishedModelRow\(previewScene\),\s*settingsData,\s*assetUrls\.buildAssetUrl\s*\)/
		)
	})

	it('refuses unsigned, tokenless URLs, which a third-party page cannot use', () => {
		expect(layout).toMatch(
			/token: tokenFromQuery,\s*allowUnsignedWithoutToken: false/
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

describe('the /preview document', () => {
	const layout = read('routes/layouts/preview-layout.tsx')
	const route = read('routes/preview-page/preview-scene.tsx')

	it('gates on membership of this scene, in this project', () => {
		expect(layout).toMatch(
			/if \(!membership \|\| membership\.projectId !== projectId\) \{\s*return withNoStoreHeaders\(ApiResponse\.notFound/
		)
		expect(layout).not.toContain('getScene(')
	})

	it('inlines the published manifest, whose URLs authenticate by cookie', () => {
		expect(layout).toMatch(
			/const manifest = previewScene\s*\?\s*await buildInlineEmbedManifest\(request, \{[^}]*token: null,\s*allowUnsignedWithoutToken: true\s*\}\)/
		)
		expect(layout).toContain('{ projectId, sceneId, manifest }')
	})

	it('hands the manifest and its preloads to the page', () => {
		expect(route).toContain('initialManifest={manifest}')
		expect(route).toContain(
			'{manifest && <EmbedResourceHints manifest={manifest} />}'
		)
	})
})

describe('the dashboard scene page', () => {
	const route = read('routes/dashboard-page/projects/scene.tsx')

	it('inlines the published manifest, whose URLs authenticate by cookie', () => {
		expect(route).toMatch(
			/const manifest = publishedMeta\s*\?\s*await buildInlineEmbedManifest\(request, \{[^}]*token: null,\s*allowUnsignedWithoutToken: true\s*\}\)/
		)
	})

	it('loads a published scene from it and a draft from the server', () => {
		expect(route).toContain(
			'sceneSourceFromManifest(sceneId, manifest, serverSource)'
		)
		expect(route).toMatch(
			/endpoint: buildPreviewSceneEndpoint\(\{ sceneId, projectId: project\.id \}\)/
		)
	})

	it('retries from the server, never the signed URLs the document carried', () => {
		expect(route).toMatch(
			/const retrySceneLoad = useCallback\(\(\) => \{\s*void load\(serverSource\)/
		)
	})

	it('forwards fetcher mutations to the scene API through a clientAction that always resolves', () => {
		expect(route).toMatch(
			/export async function clientAction\(\{\s*request,\s*params\s*\}: Route\.ClientActionArgs\) \{\s*return forwardSceneAction\(params\.sceneId, await request\.json\(\)\)/
		)
		expect(route).not.toMatch(/export async function action\(/)
	})

	it('skips every reload in its chain after a refused action', () => {
		const rule = (path: string) =>
			read(path).slice(
				read(path).indexOf(
					'export const shouldRevalidate: ShouldRevalidateFunction'
				)
			)
		expect(rule('root.tsx')).toMatch(
			/^[^}]*actionStatus,[^}]*\}\) => \{\s*if \(isRefusedAction\(actionStatus\)\) \{\s*return false/
		)
		for (const path of [
			'routes/layouts/dashboard-layout.tsx',
			'routes/dashboard-page/projects/project.tsx',
			'routes/dashboard-page/projects/scene.tsx'
		]) {
			expect(rule(path), path).toMatch(/^[\s\S]{0,600}?\t\tactionStatus,\n/)
		}
	})

	it('gates the thumbnail toggle on scene:update', () => {
		expect(route).toContain('canUpdateScene: canUpdateScene(membership)')
	})

	it('reads the publication and settings alongside its other queries', () => {
		expect(route).toMatch(
			/settingsData\s*\] = await Promise\.all\(\[[\s\S]*?getPublishedScenePreview\(projectId, sceneId\),\s*readEmbedSceneSettings\(sceneId\)\.catch\(\s*\(error: unknown\) => new EmbedSettingsReadFailure\(error\)\s*\)\s*\]\)/
		)
	})

	it('hands the drawer the stored presentation, null only when unread', () => {
		expect(route).toMatch(
			/settingsData instanceof EmbedSettingsReadFailure\s*\?\s*null\s*:\s*\(settingsData\?\.settings\?\.presentation \?\? \{\}\)/
		)
	})

	it('builds thumbnails from the asset rows, as session asset URLs', () => {
		expect(route).toMatch(
			/textureUrls: buildTextureThumbnailUrls\(sceneAssets, \(assetId\) =>\s*buildPreviewAssetUrl\(\{ sceneId, projectId, assetId \}\)/
		)
	})
})
