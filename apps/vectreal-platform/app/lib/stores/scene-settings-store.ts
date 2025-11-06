import { MetaState } from '@vctrl/hooks/use-load-model/types'
import {
	ControlsProps,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultShadowOptions,
	defaultToneMappingOptions,
	EnvironmentProps,
	ShadowsProps,
	ToneMappingProps
} from '@vctrl/viewer'
import { atom, createStore } from 'jotai'
import { atomWithReset } from 'jotai/utils'

const sceneSettingsStore = createStore()

const metaInitialState: MetaState = {
	sceneName: '',
	thumbnailUrl: null
}

const metaAtom = atomWithReset<MetaState>(metaInitialState)
const controlsAtom = atom<ControlsProps>(defaultControlsOptions)
const toneMappingAtom = atom<ToneMappingProps>(defaultToneMappingOptions)
const environmentAtom = atom<EnvironmentProps>(defaultEnvOptions)
const shadowsAtom = atom<ShadowsProps>(defaultShadowOptions)

sceneSettingsStore.set(metaAtom, metaInitialState)
sceneSettingsStore.set(controlsAtom, defaultControlsOptions)
sceneSettingsStore.set(toneMappingAtom, defaultToneMappingOptions)
sceneSettingsStore.set(environmentAtom, defaultEnvOptions)
sceneSettingsStore.set(shadowsAtom, defaultShadowOptions)

export {
	// atoms
	metaAtom,
	controlsAtom,
	toneMappingAtom,
	environmentAtom,
	shadowsAtom,

	// store
	sceneSettingsStore
}
