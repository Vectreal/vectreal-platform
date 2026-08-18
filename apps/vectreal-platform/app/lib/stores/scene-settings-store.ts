import { atom } from 'jotai'

import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultNormalizationOptions,
	defaultShadowsOptions
} from '../../constants/viewer-defaults'

import type {
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	HotspotDefinition,
	NormalizationOptions,
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
const rawModelDiagonalAtom = atom<number>(0)
const hotspotsAtom = atom<HotspotDefinition[]>([])
const activeHotspotIdAtom = atom<string | null>(null)
// Persisted shadow bake resolved from the loaded scene manifest (a data URL +
// signature), or null when the scene has none. Set during hydration so the viewer
// can render the stored shadow instead of recomputing the bake.
const bakedShadowSourceAtom = atom<BakedShadow | null>(null)
const sceneViewerSettingsAtom = atom((get) => ({
	bounds: get(boundsAtom),
	camera: get(cameraAtom),
	controls: get(controlsAtom),
	env: get(environmentAtom),
	interactions: get(interactionsAtom),
	shadows: get(shadowsAtom),
	normalization: get(normalizationAtom),
	hotspots: get(hotspotsAtom)
}))

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
	rawModelDiagonalAtom,
	selectedCameraIdAtom,
	sceneViewerSettingsAtom,
	shadowsAtom
}
