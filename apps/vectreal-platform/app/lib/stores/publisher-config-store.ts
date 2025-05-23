import {
	ControlsProps,
	EnvironmentProps,
	ToneMappingProps
} from '@vctrl/viewer'
import { atomWithReset, atomWithStorage } from 'jotai/utils'
import { atom, createStore } from 'jotai/vanilla'

import { mediumPreset } from '../constants/optimizations'

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
export interface ProcessState {
	step: 'uploading' | 'preparing' | 'publishing'
	mode: 'optimize' | 'compose' | 'publish'
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

export const optimizationAtom = atomWithReset<OptimizationState>(
	optimizationInitialState
)

//// Compose state
const controlsInitialState: ControlsProps = {
	autoRotate: true,
	autoRotateSpeed: 0.25,
	dampingFactor: 0.2,
	zoomSpeed: 0.4
}

const controlsAtom = atom<ControlsProps>(controlsInitialState)

const tonemappingInitialState: ToneMappingProps = {
	exposure: 0.9,
	mapping: 'ACESFilmic'
}

const toneMappingAtom = atom<ToneMappingProps>(tonemappingInitialState)

const envInitialState: EnvironmentProps = {
	background: false,
	backgroundIntensity: 1,
	environmentIntensity: 1,
	environmentResolution: '1k',
	preset: 'night-stars',
	backgroundColor: 'rgba(0, 0, 0, 0)',
	backgroundBlurriness: 0.5
}

const environmentAtom = atom<EnvironmentProps>(envInitialState)

interface GroundState {
	showGrid: boolean
}

const groundInitialState: GroundState = {
	showGrid: false
}
const groundAtom = atom<GroundState>(groundInitialState)

// Create a store to manage the state of the atoms
const publisherConfigStore = createStore()

publisherConfigStore.set(metaAtom, metaInitialState)
publisherConfigStore.set(controlsAtom, controlsInitialState)
publisherConfigStore.set(toneMappingAtom, tonemappingInitialState)
publisherConfigStore.set(environmentAtom, envInitialState)
publisherConfigStore.set(groundAtom, groundInitialState)
publisherConfigStore.set(processAtom, processInitialState)
publisherConfigStore.set(optimizationAtom, optimizationInitialState)

export {
	// atoms
	metaAtom,
	controlsAtom,
	toneMappingAtom,
	environmentAtom,
	groundAtom,
	processAtom,
	// store
	publisherConfigStore
}
