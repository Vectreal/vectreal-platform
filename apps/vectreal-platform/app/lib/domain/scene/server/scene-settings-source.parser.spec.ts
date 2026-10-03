import { SceneSettingsParser } from './scene-settings.parser.server'

import type { SceneSettingsRequest } from '../../../../types/api'

/**
 * The kept original on the commit. It is linked under its own role, so the
 * parser is what stops one asset from arriving as both the original and part
 * of the model: linked twice, the save fails on the primary key; linked as the
 * model, the original is downloaded into every load.
 */

const BUFFER_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'

const commit = (extra: Record<string, unknown>) =>
	SceneSettingsParser.parseSceneSettingsRequestData({
		action: 'commit-scene-save',
		sceneId: '33333333-3333-4333-8333-333333333333',
		settings: {},
		meta: { name: 'Chair' },
		sceneAssetIds: [BUFFER_ID],
		...extra
	})

const sourceOf = (result: SceneSettingsRequest | Response) => {
	if (result instanceof Response) throw new Error('expected a parsed request')
	return result.sourceAssetId
}

describe('the kept original on a commit', () => {
	it('carries the original through apart from the model', () => {
		const result = commit({ sourceAssetId: SOURCE_ID })

		expect(sourceOf(result)).toBe(SOURCE_ID)
		expect((result as SceneSettingsRequest).sceneAssetIds).toEqual([BUFFER_ID])
	})

	it('reads a commit without one as keeping none', () => {
		expect(sourceOf(commit({}))).toBeUndefined()
	})

	it('refuses an original that is not an asset id', () => {
		const result = commit({ sourceAssetId: 'source.glb' })

		expect(result).toBeInstanceOf(Response)
		expect((result as Response).status).toBe(400)
	})

	it('refuses an original that is also one of the model assets', () => {
		const result = commit({ sourceAssetId: BUFFER_ID })

		expect(result).toBeInstanceOf(Response)
		expect((result as Response).status).toBe(400)
	})
})
