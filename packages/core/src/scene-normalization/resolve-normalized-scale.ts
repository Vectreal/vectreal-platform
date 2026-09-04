import type { NormalizationOptions } from '../types/scene-types'

/** Lower bound for a model's bounding-box diagonal. */
export const NORMALIZATION_DEFAULT_MIN_SIZE = 0.5

/** Upper bound for a model's bounding-box diagonal. */
export const NORMALIZATION_DEFAULT_MAX_SIZE = 5

/**
 * The uniform scale the viewer applies to a model to bring its bounding-box
 * diagonal inside the workable range.
 *
 * Owned here rather than in the viewer because two surfaces have to agree on it
 * exactly. The viewer applies the scale; the publisher has to know what changed
 * when an author toggles normalization, so it can move the hotspots that were
 * placed under the previous scale. A second copy of this arithmetic would put
 * every marker in a scene one rounding rule away from drifting off the model.
 */
export function resolveNormalizedScale(
	rawDiagonal: number,
	options: NormalizationOptions | undefined
): number {
	if (!options?.enabled || !Number.isFinite(rawDiagonal) || rawDiagonal <= 0) {
		return 1
	}

	const min = options.minSize ?? NORMALIZATION_DEFAULT_MIN_SIZE
	const max = options.maxSize ?? NORMALIZATION_DEFAULT_MAX_SIZE

	if (rawDiagonal < min) return min / rawDiagonal
	if (rawDiagonal > max) return max / rawDiagonal
	return 1
}
