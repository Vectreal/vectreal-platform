import { isSceneOverSizeLimit } from './scene-size-limit'

describe('isSceneOverSizeLimit', () => {
	const limit = 50 * 1024 * 1024 // 50 MB

	it('is true when bytes exceed a numeric limit', () => {
		expect(isSceneOverSizeLimit(limit + 1, limit)).toBe(true)
	})

	it('is false at or under the limit', () => {
		expect(isSceneOverSizeLimit(limit, limit)).toBe(false)
		expect(isSceneOverSizeLimit(limit - 1, limit)).toBe(false)
	})

	it('is false when the limit is null (unlimited)', () => {
		expect(isSceneOverSizeLimit(limit + 1, null)).toBe(false)
	})

	it('is false when bytes are unknown', () => {
		expect(isSceneOverSizeLimit(undefined, limit)).toBe(false)
	})
})
