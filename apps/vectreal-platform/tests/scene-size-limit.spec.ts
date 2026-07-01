import {
	isSceneOverSizeLimit,
	parseSceneBytes
} from '../app/lib/domain/scene/scene-size-limit'

describe('parseSceneBytes', () => {
	it('parses a numeric string to a number', () => {
		expect(parseSceneBytes('1048576')).toBe(1048576)
	})

	it('accepts a plain number', () => {
		expect(parseSceneBytes(2048)).toBe(2048)
	})

	it('returns undefined for empty, non-numeric, or negative input', () => {
		expect(parseSceneBytes('')).toBeUndefined()
		expect(parseSceneBytes('   ')).toBeUndefined()
		expect(parseSceneBytes('abc')).toBeUndefined()
		expect(parseSceneBytes('-5')).toBeUndefined()
		expect(parseSceneBytes(undefined)).toBeUndefined()
		expect(parseSceneBytes(null)).toBeUndefined()
		expect(parseSceneBytes(Number.NaN)).toBeUndefined()
	})
})

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
