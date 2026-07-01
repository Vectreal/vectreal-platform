import {
	hasSceneMetaChanged,
	resolveSaveAvailability,
	shouldInitializeScene
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
})
