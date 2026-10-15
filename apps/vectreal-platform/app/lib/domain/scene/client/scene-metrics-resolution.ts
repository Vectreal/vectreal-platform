import type { SceneStatsData } from '../../../../types/api'
import type { OptimizationReport } from '@vctrl/core'
import type { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'

export interface SceneMetricPair {
	initial: null | number
	current: null | number
}

export interface ResolveSceneMetricsInput {
	stats?: null | SceneStatsData
	report?: null | OptimizationReport
	info?: null | OptimizationInfo
	runtime?: SceneMetricsRuntimeInput
}

export interface SceneMetricsRuntimeInput {
	initialSceneBytes?: null | number
	currentSceneBytes?: null | number
	initialTextureBytes?: null | number
	currentTextureBytes?: null | number
	isSceneSizeComputing?: boolean
}

interface NormalizedSceneMetricsRuntimeInput {
	initialSceneBytes: null | number
	currentSceneBytes: null | number
	initialTextureBytes: null | number
	currentTextureBytes: null | number
	isSceneSizeComputing: boolean
}

export interface ResolvedSceneMetrics {
	vertices: SceneMetricPair
	primitives: SceneMetricPair
	textureCount: SceneMetricPair
	textureBytes: SceneMetricPair
	sceneBytes: SceneMetricPair
	hasImproved: boolean
	isInitialMetricsHydrating: boolean
	isSceneSizeComputing: boolean
}

type NormalizedSceneMetricsSources = {
	normalizedRuntime: NormalizedSceneMetricsRuntimeInput
	hasAppliedOptimizations: boolean
	allowInfo: boolean
	allowReportBaseline: boolean
	allowReportCurrent: boolean
}

const buildSceneMetricsRuntimeInput = (
	runtime?: SceneMetricsRuntimeInput
): NormalizedSceneMetricsRuntimeInput => ({
	initialSceneBytes: runtime?.initialSceneBytes ?? null,
	currentSceneBytes: runtime?.currentSceneBytes ?? null,
	initialTextureBytes: runtime?.initialTextureBytes ?? null,
	currentTextureBytes: runtime?.currentTextureBytes ?? null,
	isSceneSizeComputing: Boolean(runtime?.isSceneSizeComputing)
})

const asNumber = (value: unknown): null | number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0
		? value
		: null

const selectFirstNumber = (...values: Array<null | number | undefined>) => {
	for (const value of values) {
		if (typeof value === 'number') {
			return value
		}
	}

	return null
}

const resolvePair = ({
	persistedInitial,
	persistedCurrent,
	runtimeInitial,
	runtimeCurrent,
	reportInitial,
	reportCurrent,
	infoInitial,
	infoCurrent,
	storedCurrent,
	allowInfo
}: {
	persistedInitial?: null | number
	persistedCurrent?: null | number
	runtimeInitial?: null | number
	runtimeCurrent?: null | number
	reportInitial?: null | number
	reportCurrent?: null | number
	infoInitial?: null | number
	infoCurrent?: null | number
	/** What the scene is now when nothing measured a result: what it stores. */
	storedCurrent?: null | number
	allowInfo: boolean
}): SceneMetricPair => {
	// Initial: persisted -> runtime -> info -> report. Current: runtime ->
	// persisted -> report -> info -> stored -> initial. `info` is least
	// authoritative and can be disabled by the caller.
	const initial = selectFirstNumber(
		asNumber(persistedInitial),
		asNumber(runtimeInitial),
		// info.initial is captured as a snapshot before any optimization runs, so it's
		// more reliable than report.before which can reflect a post-geometry-worker state
		// when geometry ran in the Web Worker before texture optimization updated the report.
		allowInfo ? asNumber(infoInitial) : null,
		asNumber(reportInitial)
	)

	const current = selectFirstNumber(
		asNumber(runtimeCurrent),
		asNumber(persistedCurrent),
		asNumber(reportCurrent),
		allowInfo ? asNumber(infoCurrent) : null,
		asNumber(storedCurrent),
		initial
	)

	return {
		initial,
		current
	}
}

const normalizeSceneMetricsSources = ({
	report,
	runtime
}: Pick<
	ResolveSceneMetricsInput,
	'report' | 'runtime'
>): NormalizedSceneMetricsSources => {
	const normalizedRuntime = buildSceneMetricsRuntimeInput(runtime)
	const hasAppliedOptimizations =
		(report?.appliedOptimizations?.length ?? 0) > 0

	return {
		normalizedRuntime,
		hasAppliedOptimizations,
		allowInfo: hasAppliedOptimizations,
		allowReportBaseline: hasAppliedOptimizations,
		allowReportCurrent: hasAppliedOptimizations
	}
}

export const resolveSceneMetrics = ({
	stats,
	report,
	info,
	runtime
}: ResolveSceneMetricsInput): ResolvedSceneMetrics => {
	const {
		normalizedRuntime,
		hasAppliedOptimizations,
		allowInfo,
		allowReportBaseline,
		allowReportCurrent
	} = normalizeSceneMetricsSources({
		report,
		runtime
	})

	// When a fresh optimization has run, trust info.optimized over stale persisted DB values.
	// persistedCurrent reflects the *previous* save's optimized state, not the current run.
	const stalePersistCurrent = hasAppliedOptimizations ? null : undefined

	const vertices = resolvePair({
		persistedInitial: stats?.baseline?.verticesCount,
		persistedCurrent: stalePersistCurrent ?? stats?.optimized?.verticesCount,
		reportInitial: allowReportBaseline
			? report?.stats.verticesCount.before
			: null,
		reportCurrent: allowReportCurrent
			? report?.stats.verticesCount.after
			: null,
		infoInitial: info?.initial.verticesCount,
		infoCurrent: info?.optimized.verticesCount,
		allowInfo
	})

	const primitives = resolvePair({
		persistedInitial: stats?.baseline?.primitivesCount,
		persistedCurrent: stalePersistCurrent ?? stats?.optimized?.primitivesCount,
		reportInitial: allowReportBaseline
			? report?.stats.primitivesCount.before
			: null,
		reportCurrent: allowReportCurrent
			? report?.stats.primitivesCount.after
			: null,
		infoInitial: info?.initial.primitivesCount,
		infoCurrent: info?.optimized.primitivesCount,
		allowInfo
	})

	const meshes = resolvePair({
		persistedInitial: stats?.baseline?.meshesCount,
		persistedCurrent: stalePersistCurrent ?? stats?.optimized?.meshesCount,
		reportInitial: allowReportBaseline ? report?.stats.meshBytes.before : null,
		reportCurrent: allowReportCurrent ? report?.stats.meshBytes.after : null,
		infoInitial: info?.initial.meshesCount,
		infoCurrent: info?.optimized.meshesCount,
		allowInfo
	})

	const textureCount = resolvePair({
		persistedInitial: stats?.baseline?.texturesCount,
		persistedCurrent: stalePersistCurrent ?? stats?.optimized?.texturesCount,
		reportInitial: allowReportBaseline
			? report?.stats.texturesCount.before
			: null,
		reportCurrent: allowReportCurrent
			? report?.stats.texturesCount.after
			: null,
		infoInitial: info?.initial.texturesCount,
		infoCurrent: info?.optimized.texturesCount,
		allowInfo
	})

	const textureBytes = resolvePair({
		persistedInitial: stats?.additionalMetrics?.initialTextureBytes,
		persistedCurrent: stats?.additionalMetrics?.currentTextureBytes,
		runtimeInitial: normalizedRuntime.initialTextureBytes,
		runtimeCurrent: normalizedRuntime.currentTextureBytes,
		reportInitial: allowReportBaseline
			? report?.stats.textureBytes.before
			: null,
		reportCurrent: allowReportCurrent ? report?.stats.textureBytes.after : null,
		allowInfo: false
	})

	const sceneBytes = resolvePair({
		persistedInitial: stats?.initialSceneBytes,
		persistedCurrent: stats?.currentSceneBytes,
		runtimeInitial: normalizedRuntime.initialSceneBytes,
		runtimeCurrent: normalizedRuntime.currentSceneBytes,
		reportInitial: allowReportBaseline ? report?.originalSize : null,
		reportCurrent: allowReportCurrent ? report?.optimizedSize : null,
		/*
		  Only a publish records the current size, so a saved scene that was
		  never published has none. What it stores, the package the runtime
		  measured from its manifest, is then what it is; the original upload
		  is not.
		*/
		storedCurrent: normalizedRuntime.initialSceneBytes,
		allowInfo: false
	})

	const hasSceneSizeImprovement =
		typeof sceneBytes.initial === 'number' &&
		typeof sceneBytes.current === 'number' &&
		sceneBytes.initial > 0 &&
		sceneBytes.current < sceneBytes.initial

	const hasCountImprovement =
		(typeof vertices.initial === 'number' &&
			typeof vertices.current === 'number' &&
			vertices.current < vertices.initial) ||
		(typeof primitives.initial === 'number' &&
			typeof primitives.current === 'number' &&
			primitives.current < primitives.initial) ||
		(typeof meshes.initial === 'number' &&
			typeof meshes.current === 'number' &&
			meshes.current < meshes.initial) ||
		(typeof textureCount.initial === 'number' &&
			typeof textureCount.current === 'number' &&
			textureCount.current < textureCount.initial)

	const hasPersistedInitialMetrics =
		stats?.baseline !== null &&
		typeof stats?.baseline === 'object' &&
		(stats?.baseline?.verticesCount != null ||
			stats?.baseline?.primitivesCount != null ||
			stats?.initialSceneBytes != null ||
			stats?.additionalMetrics?.initialTextureBytes != null)

	const hasInitialFromRuntimeOrReport =
		normalizedRuntime.initialSceneBytes != null ||
		normalizedRuntime.initialTextureBytes != null ||
		hasAppliedOptimizations

	return {
		vertices,
		primitives,
		textureCount,
		textureBytes,
		sceneBytes,
		hasImproved:
			hasSceneSizeImprovement || hasCountImprovement || hasAppliedOptimizations,
		isInitialMetricsHydrating:
			!hasPersistedInitialMetrics &&
			!hasInitialFromRuntimeOrReport &&
			normalizedRuntime.isSceneSizeComputing,
		isSceneSizeComputing: normalizedRuntime.isSceneSizeComputing
	}
}
