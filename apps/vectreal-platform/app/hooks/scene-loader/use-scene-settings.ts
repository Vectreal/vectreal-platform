import { useSetAtom } from 'jotai/react'
import { useCallback } from 'react'

import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultNormalizationOptions,
	defaultPresentationOptions,
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
	keptOriginalAtom,
	keptOriginalInitialState,
	optimizationAtom,
	optimizationInitialState,
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState
} from '../../lib/stores/scene-optimization-store'
import {
	animationAtom,
	animationDriftAtom,
	bakedShadowSourceAtom,
	boundsAtom,
	cameraAtom,
	controlsAtom,
	environmentAtom,
	hotspotsAtom,
	interactionsAtom,
	normalizationAtom,
	presentationAtom,
	rawModelDiagonalAtom,
	resetHotspotEditingAtom,
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
	const setAnimation = useSetAtom(animationAtom)
	const setAnimationDrift = useSetAtom(animationDriftAtom)
	const setBounds = useSetAtom(boundsAtom)
	const setEnv = useSetAtom(environmentAtom)
	const setInteractions = useSetAtom(interactionsAtom)
	const setCamera = useSetAtom(cameraAtom)
	const setControls = useSetAtom(controlsAtom)
	const setShadows = useSetAtom(shadowsAtom)
	const setNormalization = useSetAtom(normalizationAtom)
	const setPresentation = useSetAtom(presentationAtom)
	const setHotspots = useSetAtom(hotspotsAtom)
	const setSelectedCameraId = useSetAtom(selectedCameraIdAtom)
	// Clears the hotspot camera mode with the selection, without restoring:
	// its return camera belongs to the scene that came before.
	const resetHotspotEditing = useSetAtom(resetHotspotEditingAtom)
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
			const presentation = settings.presentation ?? defaultPresentationOptions

			setAnimation(settings.animation)
			setAnimationDrift(null)
			setBounds(bounds)
			setEnv(environment)
			setInteractions(settings.interactions)
			setCamera(camera)
			setControls(controls)
			setShadows(shadows)
			setNormalization(normalization)
			setPresentation(presentation)
			setHotspots(settings.hotspots ?? [])
			setSelectedCameraId(
				resolveDefaultSceneCameraId(camera.cameras) ??
					defaultCameraOptions.activeCameraId ??
					'default'
			)
			resetHotspotEditing()
			setLastSavedSettings(
				isSavedBaseline
					? {
							animation: settings.animation,
							bounds,
							environment,
							interactions: settings.interactions,
							camera,
							controls,
							shadows,
							normalization,
							presentation,
							hotspots: settings.hotspots
						}
					: null
			)
		},
		[
			resetHotspotEditing,
			setAnimation,
			setAnimationDrift,
			setBounds,
			setCamera,
			setControls,
			setEnv,
			setHotspots,
			setInteractions,
			setLastSavedSettings,
			setNormalization,
			setPresentation,
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
	const setAnimation = useSetAtom(animationAtom)
	const setAnimationDrift = useSetAtom(animationDriftAtom)
	const setBounds = useSetAtom(boundsAtom)
	const setEnv = useSetAtom(environmentAtom)
	const setInteractions = useSetAtom(interactionsAtom)
	const setCamera = useSetAtom(cameraAtom)
	const setControls = useSetAtom(controlsAtom)
	const setShadows = useSetAtom(shadowsAtom)
	const setNormalization = useSetAtom(normalizationAtom)
	const setPresentation = useSetAtom(presentationAtom)
	const setHotspots = useSetAtom(hotspotsAtom)
	const setSelectedCameraId = useSetAtom(selectedCameraIdAtom)
	// Clears the hotspot camera mode with the selection, without restoring:
	// its return camera belongs to the scene that came before.
	const resetHotspotEditing = useSetAtom(resetHotspotEditingAtom)
	const setBakedShadowSource = useSetAtom(bakedShadowSourceAtom)
	const setRawModelDiagonal = useSetAtom(rawModelDiagonalAtom)
	const setOptimizationState = useSetAtom(optimizationAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const setKeptOriginal = useSetAtom(keptOriginalAtom)
	const setSceneMetaState = useSetAtom(sceneMetaAtom)
	const setLastSavedSettings = useSetAtom(lastSavedSettingsAtom)
	const setLastSavedSceneMeta = useSetAtom(lastSavedSceneMetaAtom)
	const setLastSavedSceneId = useSetAtom(lastSavedSceneIdAtom)

	return useCallback(() => {
		setAnimation(undefined)
		setAnimationDrift(null)
		setBounds(defaultBoundsOptions)
		setEnv(defaultEnvOptions)
		setInteractions(undefined)
		setCamera(defaultCameraOptions)
		setControls(defaultControlsOptions)
		setShadows(defaultShadowsOptions)
		setNormalization(defaultNormalizationOptions)
		setPresentation(defaultPresentationOptions)
		setHotspots([])
		setSelectedCameraId(
			defaultCameraOptions.activeCameraId ??
				defaultCameraOptions.cameras?.[0]?.cameraId ??
				'default'
		)
		resetHotspotEditing()
		setBakedShadowSource(null)
		setRawModelDiagonal(0)
		setOptimizationState(optimizationInitialState)
		setOptimizationRuntime(optimizationRuntimeInitialState)
		setKeptOriginal(keptOriginalInitialState)
		setSceneMetaState(sceneMetaInitialState)
		setLastSavedSettings(null)
		setLastSavedSceneMeta(null)
		setLastSavedSceneId(null)
	}, [
		resetHotspotEditing,
		setAnimation,
		setAnimationDrift,
		setBakedShadowSource,
		setBounds,
		setCamera,
		setControls,
		setEnv,
		setHotspots,
		setInteractions,
		setKeptOriginal,
		setLastSavedSceneId,
		setLastSavedSceneMeta,
		setLastSavedSettings,
		setNormalization,
		setOptimizationRuntime,
		setOptimizationState,
		setPresentation,
		setRawModelDiagonal,
		setSceneMetaState,
		setSelectedCameraId,
		setShadows
	])
}
