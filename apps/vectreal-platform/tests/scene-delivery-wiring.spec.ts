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

	it('is keyed on the publication the manifest describes', () => {
		expect(route).toMatch(
			/publication = \{\s*assetId: previewScene\.publishedAssetId,\s*publishedAt: previewScene\.publishedAt\s*\}/
		)
		expect(route).toMatch(
			/buildSceneManifestEtag\(\s*sceneId,\s*manifest\.settingsUpdatedAt,\s*publication\s*\)/
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
