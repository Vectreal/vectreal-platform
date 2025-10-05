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
import { atomWithReset, atomWithStorage } from 'jotai/utils'
import { atom, createStore } from 'jotai/vanilla'

import { mediumPreset } from '../../constants/optimizations'
import type {
	MetaState,
	OptimizationState,
	ProcessState
} from '../../types/publisher-config'

const metaInitialState: MetaState = {
	sceneName: '',
	isSaved: true
}
const metaAtom = atomWithReset<MetaState>(metaInitialState)

const processInitialState: ProcessState = {
	step: 'uploading',
	mode: 'optimize',
	showSidebar: false,
	showInfo: false
}
const processAtom = atomWithStorage<ProcessState>(
	'publisher-process',
	processInitialState
)

const optimizationInitialState: OptimizationState = {
	plannedOptimizations: mediumPreset,
	optimizationPreset: 'medium'
}

const optimizationAtom = atomWithReset<OptimizationState>(
	optimizationInitialState
)

//// Compose state
const controlsAtom = atom<ControlsProps>(defaultControlsOptions)
const toneMappingAtom = atom<ToneMappingProps>(defaultToneMappingOptions)
const environmentAtom = atom<EnvironmentProps>(defaultEnvOptions)
const shadowsAtom = atom<ShadowsProps>(defaultShadowOptions)

// Create a store to manage the state of the atoms
const publisherConfigStore = createStore()

publisherConfigStore.set(metaAtom, metaInitialState)
publisherConfigStore.set(controlsAtom, defaultControlsOptions)
publisherConfigStore.set(toneMappingAtom, defaultToneMappingOptions)
publisherConfigStore.set(environmentAtom, defaultEnvOptions)
publisherConfigStore.set(shadowsAtom, defaultShadowOptions)
publisherConfigStore.set(processAtom, processInitialState)
publisherConfigStore.set(optimizationAtom, optimizationInitialState)

export {
	// atoms
	metaAtom,
	processAtom,
	optimizationAtom,
	controlsAtom,
	toneMappingAtom,
	environmentAtom,
	shadowsAtom,
	// store
	publisherConfigStore
}
