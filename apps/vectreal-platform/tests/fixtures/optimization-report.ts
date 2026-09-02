import type { OptimizationReport, OptimizationStats } from '@vctrl/core'

/**
 * A complete, typed `OptimizationReport` for specs to vary.
 *
 * Every consumer used to build its own, and two of them reached the shape by
 * casting through `as unknown as OptimizationReport` so they could name only the
 * one or two fields they cared about. That cast is the problem: it makes the
 * fixture invisible to the compiler, so a field renamed in `@vctrl/core` is not
 * a type error anywhere - it is a runtime failure in whichever assertion happens
 * to read the missing property, if any assertion does.
 *
 * That is not hypothetical. Renaming the metric fields to say their units broke
 * both cast fixtures, and `tsc` reported neither; only the suite caught them,
 * and only because an assertion happened to read the renamed field.
 *
 * So this is fully typed and complete on purpose. Adding a field to
 * `OptimizationStats` fails to compile *here*, once, instead of silently
 * leaving every spec asserting against a shape the type can no longer produce.
 *
 * The numbers are deliberately far apart in magnitude, and a size never equals
 * a count. A fixture where `meshBytes` and `meshesCount` were close would let
 * the two be swapped with every assertion still passing - which is the exact
 * defect this shape has already had once.
 */
export function buildOptimizationStats(
	overrides: Partial<OptimizationStats> = {}
): OptimizationStats {
	return {
		verticesCount: { before: 100_000, after: 60_000 },
		primitivesCount: { before: 50_000, after: 30_000 },
		materialsCount: { before: 3, after: 3 },
		textureBytes: { before: 2_000_000, after: 1_000_000 },
		texturesCount: { before: 4, after: 4 },
		textureResolutions: { before: [], after: [] },
		meshBytes: { before: 6_000_000, after: 3_000_000 },
		meshesCount: { before: 12, after: 9 },
		...overrides
	}
}

export function buildOptimizationReport(
	overrides: Partial<OptimizationReport> = {}
): OptimizationReport {
	return {
		originalSize: 8_000_000,
		optimizedSize: 5_000_000,
		compressionRatio: 1.6,
		appliedOptimizations: ['simplification', 'draco compression'],
		stats: buildOptimizationStats(),
		...overrides
	}
}
