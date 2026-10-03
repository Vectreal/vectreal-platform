import { atom } from 'jotai'

import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultNormalizationOptions,
	defaultPresentationOptions,
	defaultShadowsOptions
} from '../../constants/viewer-defaults'
import {
	isPairedHotspotCamera,
	resolveDefaultSceneCameraId
} from '../domain/scene/scene-camera'

import type {
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	HotspotDefinition,
	NormalizationOptions,
	ScenePresentationSettings,
	SceneSettings,
	ShadowsProps
} from '@vctrl/core'
import type { BakedShadow } from '@vctrl/viewer'

const boundsAtom = atom<BoundsProps>(defaultBoundsOptions)
const cameraAtom = atom<CameraProps>(defaultCameraOptions)
const selectedCameraIdAtom = atom<string>(
	defaultCameraOptions.activeCameraId ??
		defaultCameraOptions.cameras?.[0]?.cameraId ??
		'default'
)
const controlsAtom = atom<ControlsProps>(defaultControlsOptions)
const environmentAtom = atom<EnvironmentProps>(defaultEnvOptions)
const interactionsAtom = atom<SceneSettings['interactions']>(undefined)
const shadowsAtom = atom<ShadowsProps>(defaultShadowsOptions)
const normalizationAtom = atom<NormalizationOptions>(
	defaultNormalizationOptions
)
const presentationAtom = atom<ScenePresentationSettings>(
	defaultPresentationOptions
)
const rawModelDiagonalAtom = atom<number>(0)
const hotspotsAtom = atom<HotspotDefinition[]>([])

const activeHotspotIdAtom = atom<string | null>(null)

/**
 * Looking through a hotspot's camera in the Camera tool is a mode the author
 * steps into and out of: closing the tool puts back the camera from before.
 *
 * Editing a hotspot never enters it. Placing a marker writes its camera's
 * target, and the viewer applies an edit to the camera it is looking through
 * at once, so standing on that camera while placing jerked the view on every
 * click and drag.
 */
interface HotspotCameraMode {
	returnToCameraId: string
}

const hotspotCameraModeAtom = atom<HotspotCameraMode | null>(null)

/**
 * Leaves the mode, putting back the camera it was entered from. A camera
 * deleted in the meantime gives way to the scene's default.
 */
const exitHotspotCameraAtom = atom(null, (get, set) => {
	const mode = get(hotspotCameraModeAtom)
	if (!mode) return

	const cameras = get(cameraAtom).cameras
	const stillThere = cameras?.some(
		(entry) => entry.cameraId === mode.returnToCameraId
	)
	set(hotspotCameraModeAtom, null)
	set(
		selectedCameraIdAtom,
		stillThere
			? mode.returnToCameraId
			: (resolveDefaultSceneCameraId(cameras) ?? mode.returnToCameraId)
	)
})

/**
 * Picking a camera in the Camera tool. A hotspot's camera enters the mode,
 * keeping the first return camera across hops, so closing the tool puts the
 * author back; a scene camera is a choice that stays, and ends the mode where
 * it is.
 */
const selectCameraAtom = atom(null, (get, set, cameraId: string) => {
	const camera = get(cameraAtom).cameras?.find(
		(entry) => entry.cameraId === cameraId
	)
	// The minted id identifies a hotspot camera saved before the tag existed,
	// and keeps an untagged scene camera a hotspot happens to link a scene
	// camera.
	if (camera && isPairedHotspotCamera(camera)) {
		set(hotspotCameraModeAtom, {
			returnToCameraId:
				get(hotspotCameraModeAtom)?.returnToCameraId ??
				get(selectedCameraIdAtom)
		})
	} else {
		set(hotspotCameraModeAtom, null)
	}
	set(selectedCameraIdAtom, cameraId)
})

/**
 * Starts a scene with nothing selected and no mode, without putting back a
 * camera from the scene that came before.
 */
const resetHotspotEditingAtom = atom(null, (_get, set) => {
	set(hotspotCameraModeAtom, null)
	set(activeHotspotIdAtom, null)
})
// Persisted shadow bake resolved from the loaded scene manifest (a data URL +
// signature), or null when the scene has none. Set during hydration so the viewer
// can render the stored shadow instead of recomputing the bake.
const bakedShadowSourceAtom = atom<BakedShadow | null>(null)
/*
  Shaped as `SceneSettings`, field for field, deliberately. This used to name
  the environment `env`, so every consumer hand-wrote the mapping back to
  `SceneSettings` - and two of the three then enumerated the rest of the fields
  by hand and dropped whatever had been added since. Matching the type means a
  consumer spreads instead of transcribing.

  `satisfies` rather than a type annotation, and it is load-bearing: a spread
  of this object into a `SceneSettings` type-checks even when a key is
  misnamed, because every field is optional and a spread gets no excess
  property check. `satisfies` is what rejects the misnamed key here, at the one
  place it can still be seen.
*/
const sceneViewerSettingsAtom = atom(
	(get) =>
		({
			bounds: get(boundsAtom),
			camera: get(cameraAtom),
			controls: get(controlsAtom),
			environment: get(environmentAtom),
			interactions: get(interactionsAtom),
			shadows: get(shadowsAtom),
			normalization: get(normalizationAtom),
			presentation: get(presentationAtom),
			hotspots: get(hotspotsAtom)
		}) satisfies SceneSettings
)

export {
	// Vectreal viewer settings atoms
	activeHotspotIdAtom,
	exitHotspotCameraAtom,
	hotspotCameraModeAtom,
	resetHotspotEditingAtom,
	selectCameraAtom,
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
	selectedCameraIdAtom,
	sceneViewerSettingsAtom,
	shadowsAtom
}
