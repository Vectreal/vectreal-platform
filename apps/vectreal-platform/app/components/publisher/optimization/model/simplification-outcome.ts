import type { OptimizationReport } from '@vctrl/core'

export interface SimplificationOutcome {
	/** Fraction of triangles the user asked to keep (glTF-Transform's `ratio`). */
	requestedKeepRatio: number
	/** Fraction actually kept, measured from the report. */
	achievedKeepRatio: number
	trianglesBefore: number
	trianglesAfter: number
	/**
	 * True when the simplifier stopped well short of the target.
	 *
	 * `error` is a hard limit: meshoptimizer quits once further collapses would
	 * exceed the allowed shape deviation, and split vertices constrain it
	 * further. Showing a plain green tick in that case would imply the target
	 * was met when it was not.
	 */
	fellShort: boolean
}

/**
 * How much of the requested reduction has to land before the result counts as
 * meeting the target. Simplifiers rarely hit a ratio exactly, so this leaves
 * room for a near miss without excusing a run that barely moved.
 */
const ACCEPTABLE_FRACTION_OF_TARGET = 0.8

/**
 * Compares what simplification was asked for against what the report says
 * happened.
 *
 * Deliberately measured rather than projected. The panel used to show an
 * "estimated vertices" figure derived from the ratio alone, which could not
 * account for the deviation limit and was wrong on both counts.
 */
export function resolveSimplificationOutcome(
	report: OptimizationReport | null | undefined,
	requestedKeepRatio: number | undefined
): SimplificationOutcome | null {
	const trianglesBefore = report?.stats.triangles.before
	const trianglesAfter = report?.stats.triangles.after

	if (
		typeof trianglesBefore !== 'number' ||
		typeof trianglesAfter !== 'number' ||
		trianglesBefore <= 0 ||
		typeof requestedKeepRatio !== 'number'
	) {
		return null
	}

	const achievedKeepRatio = trianglesAfter / trianglesBefore
	const requestedReduction = 1 - requestedKeepRatio
	const achievedReduction = 1 - achievedKeepRatio

	return {
		requestedKeepRatio,
		achievedKeepRatio,
		trianglesBefore,
		trianglesAfter,
		fellShort:
			requestedReduction > 0 &&
			achievedReduction < requestedReduction * ACCEPTABLE_FRACTION_OF_TARGET
	}
}
