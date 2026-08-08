import {
	isSceneOverSizeLimit,
	parseSceneBytes,
	resolveSceneCurrentBytes
} from './scene-size-limit'

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

describe('resolveSceneCurrentBytes', () => {
	it('prefers a measurement from this session', () => {
		expect(
			resolveSceneCurrentBytes({
				optimizedSceneBytes: 100,
				persistedCurrentSceneBytes: 200,
				clientSceneBytes: 300
			})
		).toBe(100)
	})

	// Reopening a saved scene hydrates optimizedSceneBytes to null and
	// clientSceneBytes to the uncompressed package size. Without the persisted
	// value in between, a settings-only save would overwrite the smaller,
	// accurate figure an earlier pass had already stored.
	it('falls back to the persisted value, not the uncompressed baseline', () => {
		expect(
			resolveSceneCurrentBytes({
				optimizedSceneBytes: null,
				persistedCurrentSceneBytes: 200,
				clientSceneBytes: 300
			})
		).toBe(200)
	})

	it('uses the baseline only when nothing better exists', () => {
		expect(
			resolveSceneCurrentBytes({
				optimizedSceneBytes: null,
				persistedCurrentSceneBytes: null,
				clientSceneBytes: 300
			})
		).toBe(300)
	})

	it('returns undefined when the size is entirely unknown', () => {
		expect(resolveSceneCurrentBytes({})).toBeUndefined()
		expect(
			resolveSceneCurrentBytes({
				optimizedSceneBytes: null,
				persistedCurrentSceneBytes: null,
				clientSceneBytes: null
			})
		).toBeUndefined()
	})

	it('treats zero as a real size rather than a missing one', () => {
		expect(
			resolveSceneCurrentBytes({
				optimizedSceneBytes: 0,
				persistedCurrentSceneBytes: 200
			})
		).toBe(0)
	})

	it('skips non-finite values', () => {
		expect(
			resolveSceneCurrentBytes({
				optimizedSceneBytes: Number.NaN,
				persistedCurrentSceneBytes: 200
			})
		).toBe(200)
	})
})
