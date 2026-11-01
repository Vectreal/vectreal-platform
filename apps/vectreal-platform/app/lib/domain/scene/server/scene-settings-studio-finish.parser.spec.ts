import { SceneSettingsParser } from './scene-settings.parser.server'

import type { SceneSettingsRequest } from '../../../../types/api'

/**
 * The studio finish on a commit. Linked under its own role, so the parser
 * stops it arriving as an asset the save links some other way, and keeps
 * three meanings apart: a finish to record, null to drop the stored one, and
 * nothing at all to leave it as it is.
 */

const BUFFER_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const FINISH_ID = '44444444-4444-4444-8444-444444444444'
const reports = { occlusion: { baked: ['body'], skipped: [] } }

const commit = (extra: Record<string, unknown>) =>
	SceneSettingsParser.parseSceneSettingsRequestData({
		action: 'commit-scene-save',
		sceneId: '33333333-3333-4333-8333-333333333333',
		settings: {},
		meta: { name: 'Chair' },
		sceneAssetIds: [BUFFER_ID],
		sourceAssetId: SOURCE_ID,
		...extra
	})

const finishOf = (result: SceneSettingsRequest | Response) => {
	if (result instanceof Response) throw new Error('expected a parsed request')
	return result.studioFinish
}

const refused = (result: SceneSettingsRequest | Response) =>
	result instanceof Response && result.status === 400

describe('the studio finish on a commit', () => {
	it('carries a finish and what its bakes did', () => {
		expect(
			finishOf(
				commit({
					studioFinish: JSON.stringify({ assetId: FINISH_ID, reports })
				})
			)
		).toEqual({ assetId: FINISH_ID, reports })
	})

	it('tells dropping the finish apart from leaving it alone', () => {
		expect(finishOf(commit({ studioFinish: 'null' }))).toBeNull()
		expect(finishOf(commit({}))).toBeUndefined()
	})

	it('refuses a finish linked as a model asset or as the original', () => {
		for (const assetId of [BUFFER_ID, SOURCE_ID]) {
			expect(
				refused(commit({ studioFinish: JSON.stringify({ assetId, reports }) }))
			).toBe(true)
		}
	})

	it('refuses a finish that is not an asset id, or reports it cannot read', () => {
		expect(
			refused(
				commit({
					studioFinish: JSON.stringify({
						assetId: 'studio-finish.glb',
						reports
					})
				})
			)
		).toBe(true)
		expect(
			refused(
				commit({
					studioFinish: JSON.stringify({
						assetId: FINISH_ID,
						reports: { occlusion: { baked: 'body' } }
					})
				})
			)
		).toBe(true)
		expect(refused(commit({ studioFinish: '{not json' }))).toBe(true)
	})
})
