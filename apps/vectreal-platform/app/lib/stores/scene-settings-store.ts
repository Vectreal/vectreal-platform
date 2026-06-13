import { atom, createStore } from 'jotai'

import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultNormalizationOptions,
	defaultShadowOptions
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

const sceneSettingsStore = createStore()

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
const shadowsAtom = atom<ShadowsProps>(defaultShadowOptions)
const normalizationAtom = atom<NormalizationOptions>(
	defaultNormalizationOptions
)
const hotspotsAtom = atom<HotspotDefinition[]>([])
const activeHotspotIdAtom = atom<string | null>(null)
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

sceneSettingsStore.set(boundsAtom, defaultBoundsOptions)
sceneSettingsStore.set(cameraAtom, defaultCameraOptions)
sceneSettingsStore.set(
	selectedCameraIdAtom,
	defaultCameraOptions.activeCameraId ??
		defaultCameraOptions.cameras?.[0]?.cameraId ??
		'default'
)
sceneSettingsStore.set(controlsAtom, defaultControlsOptions)
sceneSettingsStore.set(environmentAtom, defaultEnvOptions)
sceneSettingsStore.set(interactionsAtom, undefined)
sceneSettingsStore.set(shadowsAtom, defaultShadowOptions)
sceneSettingsStore.set(normalizationAtom, defaultNormalizationOptions)
sceneSettingsStore.set(hotspotsAtom, [])
sceneSettingsStore.set(activeHotspotIdAtom, null)

export {
	// Vectreal viewer settings atoms
	activeHotspotIdAtom,
	boundsAtom,
	cameraAtom,
	controlsAtom,
	environmentAtom,
	hotspotsAtom,
	interactionsAtom,
	normalizationAtom,
	selectedCameraIdAtom,
	sceneViewerSettingsAtom,
	shadowsAtom,

	// store
	sceneSettingsStore
}
