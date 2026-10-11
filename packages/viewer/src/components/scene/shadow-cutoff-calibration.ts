/**
 * The cutoff an accumulative shadow bake draws with once it has settled.
 *
 * Pure, so the rule is testable without a WebGL context;
 * `AccumulativeShadowBake` measures the lit brightness and applies the result.
 */

// alphaTest is clamped to this safe band so a degenerate measurement can never
// blow out the plane or erase the shadow entirely.
const ALPHA_TEST_MIN = 1.0
const ALPHA_TEST_MAX = 6.0

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
