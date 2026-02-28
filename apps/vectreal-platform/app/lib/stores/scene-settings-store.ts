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
	ShadowsProps
} from '@vctrl/core'

const sceneSettingsStore = createStore()

const boundsAtom = atom<BoundsProps>(defaultBoundsOptions)
const cameraAtom = atom<CameraProps>(defaultCameraOptions)
const controlsAtom = atom<ControlsProps>(defaultControlsOptions)
const environmentAtom = atom<EnvironmentProps>(defaultEnvOptions)
const shadowsAtom = atom<ShadowsProps>(defaultShadowOptions)

sceneSettingsStore.set(boundsAtom, defaultBoundsOptions)
sceneSettingsStore.set(cameraAtom, defaultCameraOptions)
sceneSettingsStore.set(controlsAtom, defaultControlsOptions)
sceneSettingsStore.set(environmentAtom, defaultEnvOptions)
sceneSettingsStore.set(shadowsAtom, defaultShadowOptions)

export {
	// Vectreal viewer settings atoms
	boundsAtom,
	cameraAtom,
	controlsAtom,
	environmentAtom,
	shadowsAtom,

	// store
	sceneSettingsStore
}
