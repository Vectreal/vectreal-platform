import { describe, expect, it } from 'vitest'

import { calibratedAlphaTest } from './shadow-cutoff-calibration'

describe('calibratedAlphaTest', () => {
	it('scales the lit brightness by the trim', () => {
		expect(calibratedAlphaTest(4, 0.5)).toBe(2)
	})

	it('clamps to the safe band', () => {
		expect(calibratedAlphaTest(0.2, 1)).toBe(1)
		expect(calibratedAlphaTest(20, 1)).toBe(6)
	})

	it('gives no value for a degenerate measurement', () => {
		expect(calibratedAlphaTest(0, 1)).toBeNull()
		expect(calibratedAlphaTest(-1, 1)).toBeNull()
	})
})
