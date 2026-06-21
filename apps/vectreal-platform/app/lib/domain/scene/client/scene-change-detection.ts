import type { SceneStatsData } from '../../../../types/api'
import type { SceneMetaState } from '../../../../types/publisher-config'
import type { OptimizationReport, SceneSettings } from '@vctrl/core'

/**
 * Produces a stable JSON string for deep equality checks.
 * Object keys are sorted at every level so insertion order never causes
 * false positives. Arrays preserve their order — order matters for things
 * like hotspot sequences.
 */
const canonicalize = (value: unknown): string =>
	JSON.stringify(value, (_key, v) =>
		v !== null && typeof v === 'object' && !Array.isArray(v)
			? Object.fromEntries(
					Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
						a.localeCompare(b)
					)
				)
			: v
	)

const toComparableSceneMeta = ({
	name,
	description
}: SceneMetaState): Pick<SceneMetaState, 'description' | 'name'> => ({
	name,
	description
})

export const buildOptimizationReportSignature = (
	report?: OptimizationReport | null
): null | string => {
	if (!report) {
		return null
	}

	return canonicalize({
		originalSize: report.originalSize,
		optimizedSize: report.optimizedSize,
		stats: report.stats,
		appliedOptimizations: report.appliedOptimizations
	})
}

/**
 * Returns true if any field of SceneSettings differs between current and baseline.
 * Uses canonical serialization so new fields added to SceneSettings are
 * automatically included without any changes here.
 */
export const hasSceneSettingsChanged = (
	current: SceneSettings,
	baseline: SceneSettings
): boolean => canonicalize(current) !== canonicalize(baseline)

export const hasSceneMetaChanged = (
	current: SceneMetaState,
	baseline: SceneMetaState
): boolean =>
	canonicalize(toComparableSceneMeta(current)) !==
	canonicalize(toComparableSceneMeta(baseline))

interface OptimizationChangeArgs {
	reportSignature: null | string
	lastSavedReportSignature: null | string
	lastSavedSceneBytes?: null | number
	optimizedSceneBytes: null | number
	latestSceneStats: SceneStatsData | null
}

export const hasOptimizationChanges = ({
	reportSignature,
	lastSavedReportSignature,
	lastSavedSceneBytes,
	optimizedSceneBytes,
	latestSceneStats
}: OptimizationChangeArgs): boolean => {
	const hasReportChanges =
		reportSignature !== null &&
		lastSavedReportSignature !== null &&
		reportSignature !== lastSavedReportSignature

	const savedSceneBytes =
		typeof lastSavedSceneBytes === 'number'
			? lastSavedSceneBytes
			: (latestSceneStats?.currentSceneBytes ?? null)

	const hasSceneSizeChanges =
		typeof optimizedSceneBytes === 'number' &&
		optimizedSceneBytes !== savedSceneBytes

	return hasReportChanges || hasSceneSizeChanges
}

interface UnsavedChangesArgs {
	isInitializing: boolean
	currentSettings: SceneSettings
	lastSavedSettings: SceneSettings | null
	sceneMetaState: SceneMetaState
	lastSavedSceneMeta: SceneMetaState | null
	reportSignature: null | string
	lastSavedReportSignature: null | string
	lastSavedSceneBytes?: null | number
	optimizedSceneBytes: null | number
	latestSceneStats: SceneStatsData | null
}

export const hasUnsavedSceneChanges = ({
	isInitializing,
	currentSettings,
	lastSavedSettings,
	sceneMetaState,
	lastSavedSceneMeta,
	reportSignature,
	lastSavedReportSignature,
	lastSavedSceneBytes,
	optimizedSceneBytes,
	latestSceneStats
}: UnsavedChangesArgs): boolean => {
	if (isInitializing) {
		return false
	}

	const settingsBaseline = lastSavedSettings || currentSettings
	const sceneMetaBaseline = lastSavedSceneMeta || sceneMetaState

	const settingsChanged = hasSceneSettingsChanged(
		currentSettings,
		settingsBaseline
	)
	const sceneMetaChanged = hasSceneMetaChanged(
		sceneMetaState,
		sceneMetaBaseline
	)
	const optimizationChanged = hasOptimizationChanges({
		reportSignature,
		lastSavedReportSignature,
		lastSavedSceneBytes,
		optimizedSceneBytes,
		latestSceneStats
	})

	return settingsChanged || sceneMetaChanged || optimizationChanged
}
