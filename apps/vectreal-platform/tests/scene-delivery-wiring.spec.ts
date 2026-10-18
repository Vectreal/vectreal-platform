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

	it('hands a key holder only a published scene to the serving rules', () => {
		const lookup = route.indexOf(
			'await getPublishedScenePreview(projectId, sceneId)'
		)
		expect(lookup).toBeGreaterThan(
			route.indexOf('await validatePreviewApiKeyForProject(')
		)
		expect(route.slice(lookup)).toMatch(
			/^[^}]*if \(!previewScene\) \{\s*return new Response\('Asset not found', \{\s*status: 404[\s\S]*?\}\s*return servePublishedEmbedAsset\(\s*request,\s*\{ sceneId, assetId \},\s*previewScene\s*\)/
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
		expect(gate).toBeLessThan(session.indexOf('isAssetLinkedToScene('))
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
			/^[^}]*if \(!membership \|\| membership\.projectId !== previewProjectId\) \{\s*return withNoStore\(ApiResponse\.notFound/
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
			/^if \(manifestKind === 'not-found'\) \{\s*return withNoStore\(ApiResponse\.notFound\('Scene not found'\)\)/
		)
		expect(refusal).toBeLessThan(preview.indexOf('await buildSceneManifest('))
	})
})

describe('the preview POST', () => {
	const route = read('routes/api/scenes.$sceneId.ts')
	const action = route.slice(route.indexOf('export async function action('))
	const preview = action.slice(
		action.indexOf('if (isPreviewRequest) {'),
		action.indexOf('const authResult = await getAuthUser(request)')
	)

	/*
	  The client falls back to this POST when a manifest fails its shape check,
	  and it returns the working scene, so it has to ask the same rule as the
	  GET or a published scene's draft leaks onto /preview on that path.
	*/
	it('lets the manifest rule refuse a published scene before reading the draft', () => {
		expect(preview).toMatch(
			/const previewScene = await getPublishedScenePreview\(\s*previewProjectId,\s*routeSceneId\s*\)\s*const manifestKind = chooseSceneManifestKind\(\{\s*hasPublication: previewScene !== null,\s*caller: authContext\.mode\s*\}\)\s*if \(manifestKind !== 'working'\) \{\s*return withNoStore\(/
		)

		const refusal = preview.indexOf("if (manifestKind !== 'working') {")
		expect(refusal).toBeGreaterThan(-1)
		expect(refusal).toBeLessThan(
			preview.indexOf('sceneSettingsOps.getSceneSettings(')
		)
	})

	it('reads the scene every check was keyed on, never one the body names', () => {
		expect(preview).toMatch(
			/sceneSettingsOps\.getSceneSettings\(\{\s*\.\.\.parsedRequest,\s*action,\s*sceneId: routeSceneId\s*\}\)/
		)
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
			'SceneSettingsParser.parseScenePresentationUpdate(actionRequest)',
			'await updateScenePresentation('
		].map((step) => block.indexOf(step))

		expect(order.every((index) => index > -1)).toBe(true)
		expect([...order].sort((a, b) => a - b)).toEqual(order)
	})

	// The parser's refusal is pinned in scene-settings-route-actions.parser.spec.ts.
	it('returns the parser refusal as it is', () => {
		expect(block).toMatch(
			/if \(presentation instanceof Response\) \{\s*return presentation\s*\}/
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
			/!membership \|\|\s*!canPerformDashboardOperation\('scene:update', membership\)\s*\) \{\s*return ApiResponse\.notFound/
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

	it('verify the whole query the route received', () => {
		expect(route).toContain(
			'return serveSignedAsset(request, { sceneId, assetId }, url)'
		)
	})

	// The route spec mocks storage, so it cannot see that a missing row really
	// throws the error the signed path answers with a quiet 404.
	it('rely on a missing row throwing AssetNotFoundError', () => {
		expect(read('lib/domain/asset/asset-storage.server.ts')).toMatch(
			/if \(!asset\) \{\s*throw new AssetNotFoundError\(assetId\)/
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
		expect(read('lib/domain/embed/embed-asset-serving.server.ts')).toMatch(
			/showsLoadingThumbnail: shouldShowLoadingThumbnail\(\s*settingsData\?\.settings\?\.presentation\s*\)/
		)
	})
})

describe('the /preview document', () => {
	const layout = read('routes/layouts/preview-layout.tsx')
	const route = read('routes/preview-page/preview-scene.tsx')

	it('gates on membership of this scene, in this project', () => {
		expect(layout).toMatch(
			/if \(!membership \|\| membership\.projectId !== projectId\) \{\s*throw sceneNotFound\(\)/
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

	it('skips the root reload after an action that never reached the server', () => {
		const rule = read('root.tsx').slice(
			read('root.tsx').indexOf(
				'export const shouldRevalidate: ShouldRevalidateFunction'
			)
		)
		expect(rule).toMatch(
			/^[^}]*\}\) => \{\s*if \(isUnreachableAction\(actionResult\)\) \{\s*return false/
		)
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

describe('the scene mutations', () => {
	const route = read('routes/api/scenes.$sceneId.ts')
	const caseBody = (action: string) => {
		const start = route.indexOf(`case '${action}':`)
		expect(start).toBeGreaterThan(-1)
		return route.slice(start, route.indexOf('case ', start + 1))
	}

	it.each([
		['commit-scene-save', 'saveSceneSettings'],
		['commit-scene-publish', 'publishScene'],
		['revoke-scene-publish', 'revokeScenePublish']
	])(
		'%s runs inside the idempotency, load and write-lock chain',
		(action, operation) => {
			expect(caseBody(action)).toMatch(
				new RegExp(
					`await runGuardedSceneMutation\\(\\{[^}]*operation: \\(\\) =>\\s*sceneSettingsOps\\.${operation}\\(`
				)
			)
		}
	)

	it('coalesces a burst of settings reads for one user and scene', () => {
		expect(caseBody('get-scene-settings')).toMatch(
			/await runWithSceneSettingsCoalescing\(\s*getSceneSettingsRequestKey\(authResult\.user\.id, requestData\.sceneId\),\s*\(\) =>\s*sceneSettingsOps\.getSceneSettings\(/
		)
	})

	it('maps a billing refusal before reporting an error', () => {
		const outerCatch = route.slice(route.lastIndexOf('} catch (error) {'))
		const mapped = outerCatch.search(
			/const refusal = billingRefusalResponse\(error\)\s*if \(refusal\) return refusal/
		)
		expect(mapped).toBeGreaterThan(-1)
		expect(mapped).toBeLessThan(outerCatch.indexOf('reportServerError('))
	})
})

describe('uploaded marker artwork', () => {
	const manifest = read('lib/domain/scene/server/scene-manifest.server.ts')
	const serving = read('lib/domain/embed/embed-asset-serving.server.ts')

	it('hands both halves the same hotspots to authorize artwork from', () => {
		// The manifest writes the artwork URL and the asset route serves it. If
		// only one of them saw the hotspots, the two would disagree, exactly as
		// the bake once did.
		expect(manifest).toMatch(
			/selectEmbedServableAssets\(\{\s*sceneId,[\s\S]*?hotspots: settings\?\.hotspots\s*\}\)/
		)
		expect(serving).toMatch(
			/selectEmbedServableAssets\(\{\s*sceneId: ids\.sceneId,[\s\S]*?hotspots: settingsData\?\.settings\?\.hotspots\s*\}\)/
		)
	})

	it('rewrites artwork in the embed settings from the authorized ids', () => {
		expect(manifest).toMatch(
			/redactSettingsForEmbed\(settings, \{\s*bakeAssetId: servable\.bakeAssetId,\s*hotspotArtwork: \{\s*servableAssetIds: servable\.hotspotArtworkAssetIds,\s*buildAssetUrl\s*\}\s*\}\)/
		)
	})

	it('keeps artwork out of the model refs the editor downloads', () => {
		const refs = manifest.slice(
			manifest.indexOf('export function toAssetRefs('),
			manifest.indexOf('function toSourceRef(')
		)
		expect(refs).toContain('if (isUrlServedSceneAsset(asset)) continue')
	})

	it('keeps artwork out of the bytes the editor manifest inlines', () => {
		const service = read(
			'lib/domain/scene/server/scene-settings-service.server.ts'
		)
		expect(service).toMatch(
			/const assetIds = sceneAssetsData\s*\.filter\(\(asset\) => !isUrlServedSceneAsset\(asset\)\)/
		)
	})
})
