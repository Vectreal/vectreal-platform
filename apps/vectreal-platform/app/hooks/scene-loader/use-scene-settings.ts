import { useSetAtom } from 'jotai/react'
import { useCallback } from 'react'

import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultNormalizationOptions,
	defaultShadowsOptions,
	normalizeShadowOptions
} from '../../constants/viewer-defaults'
import { resolveDefaultSceneCameraId } from '../../lib/domain/scene/scene-camera'
import {
	lastSavedSceneIdAtom,
	lastSavedSceneMetaAtom,
	lastSavedSettingsAtom,
	sceneMetaAtom,
	sceneMetaInitialState
} from '../../lib/stores/publisher-config-store'
import {
	optimizationAtom,
	optimizationInitialState,
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState
} from '../../lib/stores/scene-optimization-store'
import {
	activeHotspotIdAtom,
	bakedShadowSourceAtom,
	boundsAtom,
	cameraAtom,
	controlsAtom,
	environmentAtom,
	hotspotsAtom,
	interactionsAtom,
	normalizationAtom,
	rawModelDiagonalAtom,
	selectedCameraIdAtom,
	shadowsAtom
} from '../../lib/stores/scene-settings-store'

import type { SceneSettings } from '@vctrl/core'

/**
 * Writes a scene's saved settings into the atoms the viewer renders from, and
 * records them as the save baseline.
 *
 * Covers the same atoms `useResetSceneState` does, deliberately: a scene that
 * opens without resetting first (scene to scene, base route to scene) would
 * otherwise keep the previous scene's selected camera and open hotspot.
 */
export function useApplySceneSettings() {
	const setBounds = useSetAtom(boundsAtom)
	const setEnv = useSetAtom(environmentAtom)
	const setInteractions = useSetAtom(interactionsAtom)
	const setCamera = useSetAtom(cameraAtom)
	const setControls = useSetAtom(controlsAtom)
	const setShadows = useSetAtom(shadowsAtom)
	const setNormalization = useSetAtom(normalizationAtom)
	const setHotspots = useSetAtom(hotspotsAtom)
	const setSelectedCameraId = useSetAtom(selectedCameraIdAtom)
	const setActiveHotspotId = useSetAtom(activeHotspotIdAtom)
	const setLastSavedSettings = useSetAtom(lastSavedSettingsAtom)

	/**
	 * Puts a scene's settings into the atoms.
	 *
	 * `isSavedBaseline` is explicit at both call sites rather than defaulted,
	 * because the two callers disagree and getting it wrong is invisible. A scene
	 * loaded from its route manifest *is* the saved state, so it becomes the
	 * baseline the unsaved-changes check diffs against. A draft restored from
	 * this browser has never been saved at all: adopting it as a baseline makes
	 * `hasUnsavedChanges` false for a scene with no server row, and the Save
	 * button goes dead on the one flow the draft feature exists for.
	 */
	return useCallback(
		(
			settings: SceneSettings,
			{ isSavedBaseline }: { isSavedBaseline: boolean }
		) => {
			const bounds = settings.bounds ?? defaultBoundsOptions
			const environment = settings.environment ?? defaultEnvOptions
			const camera = settings.camera ?? defaultCameraOptions
			const controls = settings.controls ?? defaultControlsOptions
			const shadows = normalizeShadowOptions(settings.shadows)
			const normalization =
				settings.normalization ?? defaultNormalizationOptions

			setBounds(bounds)
			setEnv(environment)
			setInteractions(settings.interactions)
			setCamera(camera)
			setControls(controls)
			setShadows(shadows)
			setNormalization(normalization)
			setHotspots(settings.hotspots ?? [])
			setSelectedCameraId(
				resolveDefaultSceneCameraId(camera.cameras) ??
					defaultCameraOptions.activeCameraId ??
					'default'
			)
			setActiveHotspotId(null)
			setLastSavedSettings(
				isSavedBaseline
					? {
							bounds,
							environment,
							interactions: settings.interactions,
							camera,
							controls,
							shadows,
							normalization,
							hotspots: settings.hotspots
						}
					: null
			)
		},
		[
			setActiveHotspotId,
			setBounds,
			setCamera,
			setControls,
			setEnv,
			setHotspots,
			setInteractions,
			setLastSavedSettings,
			setNormalization,
			setSelectedCameraId,
			setShadows
		]
	)
}

/**
 * Returns the scene to its defaults.
 *
 * The publisher's stores are created per mount, so this is not about cleaning
 * up after a previous visit. It is for the two transitions inside one visit
 * that leave a scene behind without unmounting anything: an upload, which
 * always starts a new unsaved scene, and going from /publisher/:sceneId back
 * to /publisher, which is the same route.
 */
export function useResetSceneState() {
	const setBounds = useSetAtom(boundsAtom)
	const setEnv = useSetAtom(environmentAtom)
	const setInteractions = useSetAtom(interactionsAtom)
	const setCamera = useSetAtom(cameraAtom)
	const setControls = useSetAtom(controlsAtom)
	const setShadows = useSetAtom(shadowsAtom)
	const setNormalization = useSetAtom(normalizationAtom)
	const setHotspots = useSetAtom(hotspotsAtom)
	const setSelectedCameraId = useSetAtom(selectedCameraIdAtom)
	const setActiveHotspotId = useSetAtom(activeHotspotIdAtom)
	const setBakedShadowSource = useSetAtom(bakedShadowSourceAtom)
	const setRawModelDiagonal = useSetAtom(rawModelDiagonalAtom)
	const setOptimizationState = useSetAtom(optimizationAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const setSceneMetaState = useSetAtom(sceneMetaAtom)
	const setLastSavedSettings = useSetAtom(lastSavedSettingsAtom)
	const setLastSavedSceneMeta = useSetAtom(lastSavedSceneMetaAtom)
	const setLastSavedSceneId = useSetAtom(lastSavedSceneIdAtom)

	return useCallback(() => {
		setBounds(defaultBoundsOptions)
		setEnv(defaultEnvOptions)
		setInteractions(undefined)
		setCamera(defaultCameraOptions)
		setControls(defaultControlsOptions)
		setShadows(defaultShadowsOptions)
		setNormalization(defaultNormalizationOptions)
		setHotspots([])
		setSelectedCameraId(
			defaultCameraOptions.activeCameraId ??
				defaultCameraOptions.cameras?.[0]?.cameraId ??
				'default'
		)
		setActiveHotspotId(null)
		setBakedShadowSource(null)
		setRawModelDiagonal(0)
		setOptimizationState(optimizationInitialState)
		setOptimizationRuntime(optimizationRuntimeInitialState)
		setSceneMetaState(sceneMetaInitialState)
		setLastSavedSettings(null)
		setLastSavedSceneMeta(null)
		setLastSavedSceneId(null)
	}, [
		setActiveHotspotId,
		setBakedShadowSource,
		setBounds,
		setCamera,
		setControls,
		setEnv,
		setHotspots,
		setInteractions,
		setLastSavedSceneId,
		setLastSavedSceneMeta,
		setLastSavedSettings,
		setNormalization,
		setOptimizationRuntime,
		setOptimizationState,
		setRawModelDiagonal,
		setSceneMetaState,
		setSelectedCameraId,
		setShadows
	])
}
