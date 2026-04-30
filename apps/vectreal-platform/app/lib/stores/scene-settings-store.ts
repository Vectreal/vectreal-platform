import { atom, createStore } from 'jotai'

import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultShadowOptions
} from '../../constants/viewer-defaults'

import type {
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
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
const sceneViewerSettingsAtom = atom((get) => ({
	bounds: get(boundsAtom),
	camera: get(cameraAtom),
	controls: get(controlsAtom),
	env: get(environmentAtom),
	interactions: get(interactionsAtom),
	shadows: get(shadowsAtom)
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

export {
	// Vectreal viewer settings atoms
	boundsAtom,
	cameraAtom,
	controlsAtom,
	environmentAtom,
	interactionsAtom,
	selectedCameraIdAtom,
	sceneViewerSettingsAtom,
	shadowsAtom,

	// store
	sceneSettingsStore
}
