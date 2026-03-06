
import type { SceneStatsData } from '../../../../types/api'
import type { SceneMetaState } from '../../../../types/publisher-config'
import type { OptimizationReport, SceneSettings } from '@vctrl/core'

export const buildOptimizationReportSignature = (
	report?: OptimizationReport | null
): null | string => {
	if (!report) {
		return null
	}

	return JSON.stringify({
		originalSize: report.originalSize,
		optimizedSize: report.optimizedSize,
		stats: report.stats,
		appliedOptimizations: report.appliedOptimizations
	})
}

export const hasSceneSettingsChanged = (
	current: SceneSettings,
	baseline: SceneSettings
): boolean => {
	return (
		JSON.stringify(current.bounds) !== JSON.stringify(baseline.bounds) ||
		JSON.stringify(current.camera) !== JSON.stringify(baseline.camera) ||
		JSON.stringify(current.environment) !==
			JSON.stringify(baseline.environment) ||
		JSON.stringify(current.controls) !== JSON.stringify(baseline.controls) ||
		JSON.stringify(current.shadows) !== JSON.stringify(baseline.shadows)
	)
}

export const hasSceneMetaChanged = (
	current: SceneMetaState,
	baseline: SceneMetaState
): boolean => JSON.stringify(current) !== JSON.stringify(baseline)

interface OptimizationChangeArgs {
	reportSignature: null | string
	lastSavedReportSignature: null | string
	optimizedSceneBytes: null | number
	latestSceneStats: SceneStatsData | null
}

export const hasOptimizationChanges = ({
	reportSignature,
	lastSavedReportSignature,
	optimizedSceneBytes,
	latestSceneStats
}: OptimizationChangeArgs): boolean => {
	const hasReportChanges =
		reportSignature !== null &&
		lastSavedReportSignature !== null &&
		reportSignature !== lastSavedReportSignature

	const hasSceneSizeChanges =
		typeof optimizedSceneBytes === 'number' &&
		optimizedSceneBytes !== (latestSceneStats?.currentSceneBytes ?? null)

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
	optimizedSceneBytes,
	latestSceneStats
}: UnsavedChangesArgs): boolean => {
	if (isInitializing) {
		return false
	}

	const settingsBaseline = lastSavedSettings || currentSettings
	const sceneMetaBaseline = lastSavedSceneMeta || sceneMetaState

	const settingsChanged = hasSceneSettingsChanged(currentSettings, settingsBaseline)
	const sceneMetaChanged = hasSceneMetaChanged(sceneMetaState, sceneMetaBaseline)
	const optimizationChanged = hasOptimizationChanges({
		reportSignature,
		lastSavedReportSignature,
		optimizedSceneBytes,
		latestSceneStats
	})

	return settingsChanged || sceneMetaChanged || optimizationChanged
}
