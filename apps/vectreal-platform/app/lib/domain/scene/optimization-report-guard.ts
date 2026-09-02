import type {
	BeforeAfterMetric,
	OptimizationReport,
	OptimizationStats
} from '@vctrl/core'

/**
 * A finite number, which `typeof x === 'number'` is not.
 *
 * `NaN` and `Infinity` both pass a bare typeof check and both survive
 * `JSON.parse` as `null` only when serialized - a client posting them directly
 * gets them through. They then reach an integer column and a metrics tile.
 */
function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value)
}

function isBeforeAfterMetric(value: unknown): value is BeforeAfterMetric {
	if (!value || typeof value !== 'object') {
		return false
	}

	const metric = value as { before?: unknown; after?: unknown }
	return isFiniteNumber(metric.before) && isFiniteNumber(metric.after)
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((entry) => typeof entry === 'string')
	)
}

/**
 * Every metric the persistence path reads, by name.
 *
 * Listed rather than inferred, because the list is the point: each of these is
 * dereferenced two levels deep by `createSceneStatsFromReport` and the byte
 * scopes beside it, so a payload missing any one of them is not a degraded
 * report - it is a `TypeError` on the server.
 */
const REQUIRED_METRICS = [
	'verticesCount',
	'primitivesCount',
	'materialsCount',
	'textureBytes',
	'texturesCount',
	'meshBytes',
	'meshesCount'
] as const satisfies readonly (keyof OptimizationStats)[]

function isOptimizationStats(value: unknown): value is OptimizationStats {
	if (!value || typeof value !== 'object') {
		return false
	}

	const stats = value as Record<string, unknown>

	if (!REQUIRED_METRICS.every((key) => isBeforeAfterMetric(stats[key]))) {
		return false
	}

	const resolutions = stats.textureResolutions as
		{ before?: unknown; after?: unknown } | undefined

	return (
		Boolean(resolutions) &&
		typeof resolutions === 'object' &&
		isStringArray(resolutions?.before) &&
		isStringArray(resolutions?.after)
	)
}

/**
 * The optimization report as the client sends it, checked before it is believed.
 *
 * This payload arrives from the browser and is persisted into `scene_stats`
 * verbatim. It used to be accepted on `typeof value === 'object'` alone and cast
 * to `OptimizationReport`, which is a promise to the compiler that it may stop
 * checking - made about a shape nothing had verified.
 *
 * Two things followed from that. Every metric on the scene detail page was
 * client-controlled rather than server-derived, so any number could be posted
 * for any scene. And a payload merely *missing* a field was worse than a
 * malicious one: `createSceneStatsFromReport` dereferences two levels deep, so
 * `{}` reached the server as a 500 rather than a 400 - a crash anyone could
 * trigger on their own scene by sending a truncated body.
 *
 * Returns `null` rather than throwing, so the caller decides the status code.
 *
 * Deliberately not a schema library. `zod` is a dependency of this app but no
 * parser in this file uses it, and `parseSceneMeta` directly above narrows by
 * hand; one file with two validation idioms is worse than either idiom.
 *
 * Unknown extra properties are allowed through. `@vctrl/core` adds metrics over
 * time and an older client posting a smaller report is a real case, so this
 * checks that everything the persistence path reads is present and sane rather
 * than that nothing else is.
 */
export function parseOptimizationReport(
	value: unknown
): OptimizationReport | null {
	/*
	  `Array.isArray` is stated rather than relied on: an array falls at the
	  field checks below anyway, since it has no `originalSize`. It is here to
	  say what this accepts, and because `parseSceneMeta` beside it rejects the
	  same shape the same way.
	*/
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null
	}

	const candidate = value as Record<string, unknown>

	if (
		!isFiniteNumber(candidate.originalSize) ||
		!isFiniteNumber(candidate.optimizedSize) ||
		!isFiniteNumber(candidate.compressionRatio)
	) {
		return null
	}

	if (!isStringArray(candidate.appliedOptimizations)) {
		return null
	}

	if (!isOptimizationStats(candidate.stats)) {
		return null
	}

	return candidate as unknown as OptimizationReport
}
