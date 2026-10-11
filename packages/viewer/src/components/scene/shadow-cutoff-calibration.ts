/**
 * When the accumulative shadow's cutoff needs calibrating, and to what.
 *
 * Pure, so the rule is testable without a WebGL context; `ShadowAutoCutoff`
 * does the measuring and the writing.
 */

// alphaTest is clamped to this safe band so a degenerate measurement can never
// blow out the plane or erase the shadow entirely.
const ALPHA_TEST_MIN = 1.0
const ALPHA_TEST_MAX = 6.0

interface CutoffCalibrationState {
	/** Whether the bake accumulates across frames or in one synchronous pass. */
	temporal: boolean
	/** drei's frame counter. A non-temporal bake never advances it. */
	count: number
	frames: number
	/** The shadow material's alphaTest as it is now. */
	alphaTest: number
	/** The alphaTest this calibrator last wrote, or null when it has to recalibrate. */
	lastWritten: number | null
}

/**
 * What the calibrator should do this frame.
 *
 * - `baking`: a temporal bake is still accumulating. Its restart is seen here,
 *   as drei's counter dropping below `frames`, so the caller forgets the value
 *   it wrote and calibrates once the bake settles, whatever drei writes back.
 * - `calibrate`: the bake has settled and the material no longer carries the
 *   value last written. A non-temporal bake never advances the counter, so this
 *   is the only way its re-bake shows: drei writes the configured alphaTest
 *   over ours on every reset and bake. If it happens to write back exactly the
 *   value calibrated last time, the re-bake goes unnoticed.
 * - `current`: the material still holds the calibrated value.
 */
export const cutoffCalibrationStep = ({
	temporal,
	count,
	frames,
	alphaTest,
	lastWritten
}: CutoffCalibrationState): 'baking' | 'calibrate' | 'current' => {
	if (temporal && count < frames) return 'baking'
	return alphaTest === lastWritten ? 'current' : 'calibrate'
}

/**
 * The alphaTest that makes the lit plane exactly transparent: its measured
 * brightness, trimmed by `cutoffScale` and clamped to the safe band. Null for a
 * measurement that read nothing.
 */
export const calibratedAlphaTest = (
	litBrightness: number,
	cutoffScale: number
): number | null => {
	if (litBrightness <= 0) return null
	return Math.min(
		ALPHA_TEST_MAX,
		Math.max(ALPHA_TEST_MIN, litBrightness * cutoffScale)
	)
}
