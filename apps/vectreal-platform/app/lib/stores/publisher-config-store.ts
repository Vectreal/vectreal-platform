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

interface MetaState {
	sceneName: string
	isSaved: boolean
}

const metaInitialState: MetaState = {
	sceneName: '',
	isSaved: true
}
const metaAtom = atomWithReset<MetaState>(metaInitialState)

//// Process state
export type SidebarMode = 'optimize' | 'compose' | 'publish'
export interface ProcessState {
	step: 'uploading' | 'preparing' | 'publishing'
	mode: SidebarMode
	showSidebar: boolean
	showInfo: boolean
}

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

//// Optimization state
export type OptimizationNames =
	| 'simplification'
	| 'texture'
	| 'quantize'
	| 'dedup'
	| 'normals'

interface BaseOptimization<Name = OptimizationNames> {
	name: Name
	enabled: boolean
}
interface SimplificationOptimization
	extends BaseOptimization<'simplification'> {
	/**
	 * Target ratio (0–1) of vertices to keep.
	 */
	ratio: number
	/**
	 * Limit on error, as a fraction of mesh radius. Default: 0.0001 (0.01%).
	 * Higher values will produce lower quality meshes.
	 */
	error: number
}
export interface TextureOptimization extends BaseOptimization<'texture'> {
	resize: [number, number]
	quality: number
	targetFormat: 'jpeg' | 'png' | 'webp'
}
type QuantizeOptimization = BaseOptimization<'quantize'>
type DedupOptimization = BaseOptimization<'dedup'>
type NormalsOptimization = BaseOptimization<'normals'>

export type PossibleOptimizations = {
	simplification: SimplificationOptimization
	texture: TextureOptimization
	quantize: QuantizeOptimization
	dedup: DedupOptimization
	normals: NormalsOptimization
}

export type OptimizationPreset = 'low' | 'medium' | 'high'

export interface OptimizationState {
	plannedOptimizations: PossibleOptimizations
	optimizationPreset: OptimizationPreset
}

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
