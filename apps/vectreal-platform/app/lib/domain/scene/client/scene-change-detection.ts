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

/**
 * `thumbnailUrl` is excluded on purpose: it is server-assigned and can change
 * on its own (regeneration, cache busting), which would falsely mark a scene
 * dirty. Manual captures are handled separately below.
 */
const toComparableSceneMeta = ({
	name,
	description
}: SceneMetaState): Pick<SceneMetaState, 'description' | 'name'> => ({
	name,
	description
})

/**
 * A thumbnail the user just captured from the viewport, still held as an inline
 * data URL because it has not been uploaded yet.
 *
 * The server never hands back a `data:` URL, so this cleanly separates "the
 * user framed and captured a new thumbnail" from "the server changed the URL",
 * and only the former should count as an unsaved change.
 */
export const isLocallyCapturedThumbnail = (thumbnailUrl?: string): boolean =>
	typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('data:')

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
): boolean => {
	if (
		canonicalize(toComparableSceneMeta(current)) !==
		canonicalize(toComparableSceneMeta(baseline))
	) {
		return true
	}

	// Without this a manual recapture would leave the scene looking clean, and
	// the user could navigate away having silently lost it.
	return (
		isLocallyCapturedThumbnail(current.thumbnailUrl) &&
		current.thumbnailUrl !== baseline.thumbnailUrl
	)
}

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
	suppressDirtyDetection: boolean
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
	suppressDirtyDetection,
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
	if (suppressDirtyDetection) {
		return false
	}

	if (lastSavedSettings === null || lastSavedSceneMeta === null) {
		// Scene has never been saved, so there is no baseline to diff against.
		// Anything present is by definition unsaved.
		return true
	}

	const settingsChanged = hasSceneSettingsChanged(
		currentSettings,
		lastSavedSettings
	)
	const sceneMetaChanged = hasSceneMetaChanged(
		sceneMetaState,
		lastSavedSceneMeta
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
