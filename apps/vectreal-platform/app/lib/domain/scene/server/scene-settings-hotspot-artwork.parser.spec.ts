import { SceneSettingsParser } from './scene-settings.parser.server'
import { buildHotspotArtworkUrl } from '../hotspot-artwork'

/**
 * Uploaded marker artwork on a commit: the thumbnail's rule for a hotspot's
 * `payloadUrl`. The path is a reference to an asset, so it must be this scene's
 * path for an asset the same commit links. Stored unexamined it could name any
 * asset id; the embed policy would still refuse to serve it, but the row would
 * carry a reference to something the scene does not own.
 */

const SCENE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_SCENE_ID = '44444444-4444-4444-8444-444444444444'
const HOTSPOT_ID = '11111111-1111-4111-8111-111111111111'
const ARTWORK_ID = '22222222-2222-4222-8222-222222222222'
const UNLINKED_ID = '55555555-5555-4555-8555-555555555555'

const commit = (payloadUrl: string, stylePreset = 'image') =>
	SceneSettingsParser.parseSceneSettingsRequestData({
		action: 'commit-scene-save',
		sceneId: SCENE_ID,
		settings: {
			camera: { cameras: [{ cameraId: 'cam-1', kind: 'scene' }] },
			hotspots: [
				{
					id: HOTSPOT_ID,
					name: 'Rear badge',
					worldPosition: [1, 2, 3],
					visible: true,
					internalOnly: false,
					stylePreset,
					payloadUrl
				}
			]
		},
		meta: { name: 'Chair' },
		sceneAssetIds: [ARTWORK_ID]
	})

const refusal = async (result: unknown) => {
	expect(result).toBeInstanceOf(Response)
	expect((result as Response).status).toBe(400)
	return ((await (result as Response).clone().json()) as { error: string })
		.error
}

describe('uploaded marker artwork on a commit', () => {
	it("keeps this scene's path for an asset the commit links", () => {
		const url = buildHotspotArtworkUrl(SCENE_ID, ARTWORK_ID)
		const result = commit(url)

		expect(result).not.toBeInstanceOf(Response)
		if (result instanceof Response) return
		expect(result.settings?.hotspots?.[0].payloadUrl).toBe(url)
	})

	it.each([
		['an asset the commit does not link', SCENE_ID, UNLINKED_ID],
		['a path into another scene', OTHER_SCENE_ID, ARTWORK_ID]
	])('refuses %s, naming the marker', async (_label, sceneId, assetId) => {
		const error = await refusal(
			commit(buildHotspotArtworkUrl(sceneId, assetId))
		)

		expect(error).toContain('Marker "Rear badge"')
	})

	it('checks a dot too, since a stored path outlives the switch to a dot', async () => {
		const error = await refusal(
			commit(buildHotspotArtworkUrl(SCENE_ID, UNLINKED_ID), 'dot')
		)

		expect(error).toContain('has artwork this save does not include')
	})
})
