import {
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	SceneMeta,
	ShadowsProps
} from '@vctrl/core'
import {
	defaultBoundsOptions,
	defaultCameraOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultShadowOptions
} from '@vctrl/viewer'
import { atom, createStore } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import {} from 'packages/viewer/src/components/scene/scene-bounds'

const sceneSettingsStore = createStore()

const metaInitialState: SceneMeta = {
	sceneName: '',
	thumbnailUrl: null
}

const metaAtom = atomWithReset<SceneMeta>(metaInitialState)

const boundsAtom = atom<BoundsProps>(defaultBoundsOptions)
const cameraAtom = atom<CameraProps>(defaultCameraOptions)
const controlsAtom = atom<ControlsProps>(defaultControlsOptions)
const environmentAtom = atom<EnvironmentProps>(defaultEnvOptions)
const shadowsAtom = atom<ShadowsProps>(defaultShadowOptions)

sceneSettingsStore.set(metaAtom, metaInitialState)

sceneSettingsStore.set(boundsAtom, defaultBoundsOptions)
sceneSettingsStore.set(cameraAtom, defaultCameraOptions)
sceneSettingsStore.set(controlsAtom, defaultControlsOptions)
sceneSettingsStore.set(environmentAtom, defaultEnvOptions)
sceneSettingsStore.set(shadowsAtom, defaultShadowOptions)

export {
	// Management atoms
	metaAtom,

	// Vectreal viewer settings atoms
	boundsAtom,
	cameraAtom,
	controlsAtom,
	environmentAtom,
	shadowsAtom,

	// store
	sceneSettingsStore
}
