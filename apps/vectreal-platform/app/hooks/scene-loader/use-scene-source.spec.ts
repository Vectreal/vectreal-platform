import { describe, expect, it } from 'vitest'

import { leavesForEmptyStage } from './use-scene-source'

const none = { sceneId: null, generationId: null }

describe('leavesForEmptyStage', () => {
	it('resets when a saved scene is left for the bare publisher', () => {
		expect(leavesForEmptyStage({ ...none, sceneId: 's1' }, none)).toBe(true)
	})

	it('resets when Back leaves an opened variant', () => {
		expect(leavesForEmptyStage({ ...none, generationId: 'j1' }, none)).toBe(
			true
		)
	})

	it('keeps the model when saving a variant moves the URL to its new scene', () => {
		expect(
			leavesForEmptyStage(
				{ ...none, generationId: 'j1' },
				{ ...none, sceneId: 's1' }
			)
		).toBe(false)
	})

	it('does nothing on the bare publisher, where a dropped file is unsaved', () => {
		expect(leavesForEmptyStage(none, none)).toBe(false)
	})
})
