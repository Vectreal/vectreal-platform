import { useSetAtom } from 'jotai/react'
import { useCallback } from 'react'

import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultNormalizationOptions,
	defaultShadowOptions,
	normalizeShadowOptions
} from '../../constants/viewer-defaults'
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
	const setRawModelDiagonal = useSetAtom(rawModelDiagonalAtom)
	const setLastSavedSettings = useSetAtom(lastSavedSettingsAtom)

	return useCallback(
		(settings: SceneSettings) => {
			const bounds = settings.bounds ?? defaultBoundsOptions
			const environment = settings.environment ?? defaultEnvOptions
			const camera = settings.camera ?? defaultCameraOptions
			const controls = settings.controls ?? defaultControlsOptions
			const shadows = normalizeShadowOptions(settings.shadows)
			const normalization = settings.normalization ?? defaultNormalizationOptions

			setBounds(bounds)
			setEnv(environment)
			setInteractions(settings.interactions)
			setCamera(camera)
			setControls(controls)
			setShadows(shadows)
			setNormalization(normalization)
			setHotspots(settings.hotspots ?? [])
			setRawModelDiagonal(0)
			setLastSavedSettings({
				bounds,
				environment,
				interactions: settings.interactions,
				camera,
				controls,
				shadows,
				normalization,
				hotspots: settings.hotspots
			})
		},
		[
			setBounds,
			setCamera,
			setControls,
			setEnv,
			setHotspots,
			setInteractions,
			setLastSavedSettings,
			setNormalization,
			setRawModelDiagonal,
			setShadows
		]
	)
}

/**
 * Returns the scene to its defaults.
 *
 * The publisher's stores are created per mount, so this is not about cleaning up
 * after a previous visit. It is for the one case that happens inside a single
 * visit: dropping a new model while a scene is already open.
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
		setShadows(defaultShadowOptions)
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
