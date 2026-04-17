import {
	hasSceneMetaChanged,
	resolveSaveAvailability,
	shouldInitializeScene,
	shouldRequireFirstSaveOptimization
} from '../app/lib/domain/scene'

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

	it('does not require first-save optimization once a save marker exists', () => {
		expect(
			shouldRequireFirstSaveOptimization({
				currentSceneId: null,
				lastSavedSceneId: 'scene-1',
				hasAppliedOptimization: false
			})
		).toBe(false)
	})

	it('requires first-save optimization for unsaved unoptimized uploads', () => {
		expect(
			shouldRequireFirstSaveOptimization({
				currentSceneId: null,
				lastSavedSceneId: null,
				hasAppliedOptimization: false
			})
		).toBe(true)
	})

	it('returns ready when live dirty state is true', () => {
		expect(
			resolveSaveAvailability({
				userId: 'user-1',
				isFirstSavePendingOptimization: false,
				hasChanges: true
			})
		).toEqual({
			canSave: true,
			reason: 'ready',
			isFirstSavePendingOptimization: false
		})
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
})
