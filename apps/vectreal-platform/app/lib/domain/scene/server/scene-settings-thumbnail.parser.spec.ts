import { SceneSettingsParser } from './scene-settings.parser.server'
import { buildSceneThumbnailUrl } from '../scene-thumbnail-url'

import type { SceneSettingsRequest } from '../../../../types/api'

/**
 * The thumbnail URL on a commit. It is written to `scenes.thumbnail_url`, which
 * the thumbnail route and the GC both read, so the parser keeps it to the one
 * shape the publisher builds: this scene's thumbnail route for an asset the
 * same commit links. The save then asserts every linked asset is in the
 * scene's project, which is what keeps a foreign asset id out of the column.
 */

const SCENE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_SCENE_ID = '44444444-4444-4444-8444-444444444444'
const BUFFER_ID = '11111111-1111-4111-8111-111111111111'
const THUMBNAIL_ID = '22222222-2222-4222-8222-222222222222'
const UNLINKED_ID = '55555555-5555-4555-8555-555555555555'

const commit = (thumbnailUrl: unknown) =>
	SceneSettingsParser.parseSceneSettingsRequestData({
		action: 'commit-scene-save',
		sceneId: SCENE_ID,
		settings: {},
		meta: { name: 'Chair', thumbnailUrl },
		sceneAssetIds: [BUFFER_ID, THUMBNAIL_ID]
	})

const thumbnailOf = (result: SceneSettingsRequest | Response) => {
	if (result instanceof Response) throw new Error('expected a parsed request')
	return result.meta?.thumbnailUrl
}

const expectRefused = (result: SceneSettingsRequest | Response) => {
	expect(result).toBeInstanceOf(Response)
	expect((result as Response).status).toBe(400)
}

describe('the thumbnail URL on a commit', () => {
	it("keeps this scene's thumbnail for an asset the commit links", () => {
		const url = buildSceneThumbnailUrl(SCENE_ID, THUMBNAIL_ID)

		expect(thumbnailOf(commit(url))).toBe(url)
	})

	it('reads an empty or missing thumbnail as none', () => {
		expect(thumbnailOf(commit(''))).toBe('')
		expect(thumbnailOf(commit('   '))).toBe('')
		expect(thumbnailOf(commit(undefined))).toBe('')
	})

	it('refuses an asset the commit does not link', () => {
		expectRefused(commit(buildSceneThumbnailUrl(SCENE_ID, UNLINKED_ID)))
	})

	it("refuses another scene's thumbnail route", () => {
		expectRefused(commit(buildSceneThumbnailUrl(OTHER_SCENE_ID, THUMBNAIL_ID)))
	})

	it('refuses a URL that only ends in a linked thumbnail', () => {
		expectRefused(
			commit(
				`https://evil.test${buildSceneThumbnailUrl(SCENE_ID, THUMBNAIL_ID)}`
			)
		)
	})

	it('refuses an inline image', () => {
		expectRefused(commit('data:image/webp;base64,AAAA'))
	})
})
