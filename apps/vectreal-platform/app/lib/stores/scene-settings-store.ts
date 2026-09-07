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
