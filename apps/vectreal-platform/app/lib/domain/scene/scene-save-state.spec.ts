import {
	hasSceneMetaChanged,
	hasUnsavedSceneChanges,
	isSaveActionBlocked,
	resolveSaveAvailability
} from '.'

import type { SceneSettings } from '@vctrl/core'

describe('scene save state', () => {
	it('blocks save with nothing on the stage, ahead of every other reason', () => {
		for (const userId of [undefined, 'user-1']) {
			for (const isSceneOverSizeLimit of [false, true]) {
				for (const hasChanges of [false, true]) {
					expect(
						resolveSaveAvailability({
							hasModel: false,
							userId,
							isSceneOverSizeLimit,
							hasChanges
						})
					).toEqual({ canSave: false, reason: 'no-model' })
				}
			}
		}
	})

	it('lets a Save control refuse every reason but a missing account', () => {
		expect(isSaveActionBlocked({ canSave: true, reason: 'ready' })).toBe(false)
		expect(isSaveActionBlocked({ canSave: false, reason: 'no-user' })).toBe(
			false
		)
		for (const reason of [
			'no-model',
			'no-unsaved-changes',
			'requires-size-reduction'
		] as const) {
			expect(isSaveActionBlocked({ canSave: false, reason }), reason).toBe(true)
		}
	})

	it('blocks save with no user', () => {
		expect(
			resolveSaveAvailability({
				hasModel: true,
				userId: undefined,
				isSceneOverSizeLimit: false,
				hasChanges: true
			})
		).toEqual({ canSave: false, reason: 'no-user' })
	})

	it('requires size reduction when over the limit', () => {
		expect(
			resolveSaveAvailability({
				hasModel: true,
				userId: 'user-1',
				isSceneOverSizeLimit: true,
				hasChanges: true
			})
		).toEqual({ canSave: false, reason: 'requires-size-reduction' })
	})

	it('returns ready when live dirty state is true', () => {
		expect(
			resolveSaveAvailability({
				hasModel: true,
				userId: 'user-1',
				isSceneOverSizeLimit: false,
				hasChanges: true
			})
		).toEqual({ canSave: true, reason: 'ready' })
	})

	it('reports no-unsaved-changes when under limit with no changes', () => {
		expect(
			resolveSaveAvailability({
				hasModel: true,
				userId: 'user-1',
				isSceneOverSizeLimit: false,
				hasChanges: false
			})
		).toEqual({ canSave: false, reason: 'no-unsaved-changes' })
	})

	it('ignores thumbnail-only scene meta changes for dirty tracking', () => {
		expect(
			hasSceneMetaChanged(
				{
					name: 'Scene A',
					description: 'Primary scene',
					thumbnailUrl: '/api/scenes/1/thumbnail/new'
				},
				{
					name: 'Scene A',
					description: 'Primary scene',
					thumbnailUrl: '/api/scenes/1/thumbnail/old'
				}
			)
		).toBe(false)
	})

	// A `data:` URL can only come from the user capturing one in this session —
	// the server never returns one — so it is a real unsaved change.
	it('detects a manually captured thumbnail as a change', () => {
		expect(
			hasSceneMetaChanged(
				{
					name: 'Scene A',
					description: 'Primary scene',
					thumbnailUrl: 'data:image/webp;base64,AAAA'
				},
				{
					name: 'Scene A',
					description: 'Primary scene',
					thumbnailUrl: '/api/scenes/1/thumbnail/old'
				}
			)
		).toBe(true)
	})

	it('still detects editable scene meta changes', () => {
		expect(
			hasSceneMetaChanged(
				{
					name: 'Scene B',
					description: 'Updated',
					thumbnailUrl: '/api/scenes/1/thumbnail/current'
				},
				{
					name: 'Scene A',
					description: 'Updated',
					thumbnailUrl: '/api/scenes/1/thumbnail/current'
				}
			)
		).toBe(true)
	})

	it('treats a never-saved scene as having unsaved changes', () => {
		const currentSettings = { environment: 'studio' } as SceneSettings

		expect(
			hasUnsavedSceneChanges({
				suppressDirtyDetection: false,
				currentSettings,
				lastSavedSettings: null,
				sceneMetaState: {
					name: 'New scene',
					description: '',
					thumbnailUrl: ''
				},
				lastSavedSceneMeta: null,
				reportSignature: null,
				lastSavedReportSignature: null,
				optimizedSceneBytes: null,
				latestSceneStats: null
			})
		).toBe(true)
	})

	it('detects no changes once a baseline has been saved and nothing edited', () => {
		const settings = { environment: 'studio' } as SceneSettings
		const sceneMeta = { name: 'Scene A', description: '', thumbnailUrl: '' }

		expect(
			hasUnsavedSceneChanges({
				suppressDirtyDetection: false,
				currentSettings: settings,
				lastSavedSettings: settings,
				sceneMetaState: sceneMeta,
				lastSavedSceneMeta: sceneMeta,
				reportSignature: null,
				lastSavedReportSignature: null,
				optimizedSceneBytes: null,
				latestSceneStats: null
			})
		).toBe(false)
	})
})
