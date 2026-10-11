import { describe, expect, it } from 'vitest'

import {
	calibratedAlphaTest,
	cutoffCalibrationStep
} from './shadow-cutoff-calibration'

const settledStatic = {
	temporal: false,
	// drei never advances the count of a non-temporal bake.
	count: 0,
	frames: 48
}

describe('cutoffCalibrationStep', () => {
	it('recalibrates a static bake that re-baked over the calibrated value', () => {
		// drei's non-temporal bake writes the configured alphaTest back.
		expect(
			cutoffCalibrationStep({
				...settledStatic,
				alphaTest: 3,
				lastWritten: 4.2
			})
		).toBe('calibrate')
	})

	it('leaves a material that still carries the calibrated value alone', () => {
		expect(
			cutoffCalibrationStep({
				...settledStatic,
				alphaTest: 4.2,
				lastWritten: 4.2
			})
		).toBe('current')
	})

	it('recalibrates after a reset left alphaTest at zero', () => {
		expect(
			cutoffCalibrationStep({
				...settledStatic,
				alphaTest: 0,
				lastWritten: 4.2
			})
		).toBe('calibrate')
	})

	it('calibrates when nothing has been written yet', () => {
		expect(
			cutoffCalibrationStep({
				...settledStatic,
				alphaTest: 3,
				lastWritten: null
			})
		).toBe('calibrate')
	})

	it('waits while a temporal bake is still accumulating', () => {
		expect(
			cutoffCalibrationStep({
				temporal: true,
				count: 10,
				frames: 48,
				alphaTest: 1.2,
				lastWritten: null
			})
		).toBe('baking')
	})

	it('reports a temporal restart even when its value matches the last write', () => {
		// A clamped calibration, or an adopted value after an empty measurement,
		// can equal what the ramp passes through or ends on.
		expect(
			cutoffCalibrationStep({
				temporal: true,
				count: 0,
				frames: 48,
				alphaTest: 6,
				lastWritten: 6
			})
		).toBe('baking')
	})

	it('calibrates a temporal bake once it has settled', () => {
		expect(
			cutoffCalibrationStep({
				temporal: true,
				count: 48,
				frames: 48,
				alphaTest: 3,
				lastWritten: 4.2
			})
		).toBe('calibrate')
	})
})

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
