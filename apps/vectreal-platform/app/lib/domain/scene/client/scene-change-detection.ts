import { buildDefaultCameraSignature } from '../scene-camera'

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
 * Everything a thumbnail capture paints besides the model's own geometry: the
 * frame the default camera opens on, the normalization that sizes the model
 * inside it, and the environment behind it - the HDRI shown as background, its
 * blur and intensity, and the `backdrop` stage the screenshot composites in. A
 * saved thumbnail is stale once any of these changes.
 *
 * Whether or not the default camera has a pose: without one the viewer stands
 * it at the frame the scene opened on, and a capture from it renders there.
 *
 * Shadows are left out on purpose: `shadows.baked.assetId` moves whenever a
 * bake is saved, and including it would recapture on every such save.
 */
export const buildThumbnailFrameSignature = (
	settings:
		| Pick<SceneSettings, 'camera' | 'environment' | 'normalization'>
		| null
		| undefined
): string => {
	const cameras = settings?.camera?.cameras
	return canonicalize({
		camera: buildDefaultCameraSignature(cameras),
		environment: settings?.environment ?? null,
		normalization: settings?.normalization ?? null
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
	passRevision: number
	savedPassRevision: null | number
}

/**
 * Whether optimization changed the document since it was saved: a pass ran
 * since, or the report differs from the one last saved. Asked of the pass, not
 * of a size: no size the client knows is one the server stores.
 */
export const hasOptimizationChanges = ({
	reportSignature,
	lastSavedReportSignature,
	passRevision,
	savedPassRevision
}: OptimizationChangeArgs): boolean => {
	const hasReportChanges =
		reportSignature !== null &&
		lastSavedReportSignature !== null &&
		reportSignature !== lastSavedReportSignature

	return hasReportChanges || passRevision !== savedPassRevision
}

interface UnsavedChangesArgs {
	suppressDirtyDetection: boolean
	currentSettings: SceneSettings
	lastSavedSettings: SceneSettings | null
	sceneMetaState: SceneMetaState
	lastSavedSceneMeta: SceneMetaState | null
	reportSignature: null | string
	lastSavedReportSignature: null | string
	passRevision: number
	savedPassRevision: null | number
}

export const hasUnsavedSceneChanges = ({
	suppressDirtyDetection,
	currentSettings,
	lastSavedSettings,
	sceneMetaState,
	lastSavedSceneMeta,
	reportSignature,
	lastSavedReportSignature,
	passRevision,
	savedPassRevision
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
		passRevision,
		savedPassRevision
	})

	return settingsChanged || sceneMetaChanged || optimizationChanged
}
