import {
	hasSceneMetaChanged,
	hasUnsavedSceneChanges,
	resolveSaveAvailability,
	shouldInitializeScene
} from '../app/lib/domain/scene'

import type { SceneSettings } from '@vctrl/core'

describe('scene save state', () => {
	it('does not initialize on same-scene revalidation', () => {
		expect(
			shouldInitializeScene({
				hasSceneChanged: false,
				paramSceneId: 'scene-1',
				initialSceneAggregate: { sceneId: 'scene-1' } as never,
				isPostSaveNavigation: false
			})
		).toBe(false)
	})

	it('does not initialize on post-save navigation', () => {
		expect(
			shouldInitializeScene({
				hasSceneChanged: true,
				paramSceneId: 'scene-1',
				initialSceneAggregate: { sceneId: 'scene-1' } as never,
				isPostSaveNavigation: true
			})
		).toBe(false)
	})

	it('initializes on real scene loads', () => {
		expect(
			shouldInitializeScene({
				hasSceneChanged: true,
				paramSceneId: 'scene-1',
				initialSceneAggregate: { sceneId: 'scene-1' } as never,
				isPostSaveNavigation: false
			})
		).toBe(true)
	})

	it('blocks save with no user', () => {
		expect(
			resolveSaveAvailability({
				userId: undefined,
				isSceneOverSizeLimit: false,
				hasChanges: true
			})
		).toEqual({ canSave: false, reason: 'no-user' })
	})

	it('requires size reduction when over the limit', () => {
		expect(
			resolveSaveAvailability({
				userId: 'user-1',
				isSceneOverSizeLimit: true,
				hasChanges: true
			})
		).toEqual({ canSave: false, reason: 'requires-size-reduction' })
	})

	it('returns ready when live dirty state is true', () => {
		expect(
			resolveSaveAvailability({
				userId: 'user-1',
				isSceneOverSizeLimit: false,
				hasChanges: true
			})
		).toEqual({ canSave: true, reason: 'ready' })
	})

	it('reports no-unsaved-changes when under limit with no changes', () => {
		expect(
			resolveSaveAvailability({
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
				isInitializing: false,
				currentSettings,
				lastSavedSettings: null,
				sceneMetaState: { name: 'New scene', description: '', thumbnailUrl: '' },
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
				isInitializing: false,
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
