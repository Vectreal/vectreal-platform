import { Stage } from '@react-three/drei'
import { PresetsType } from '@react-three/drei/helpers/environment-assets'
import { atomWithReset, atomWithStorage } from 'jotai/utils'
import { atom, createStore } from 'jotai/vanilla'
import { ComponentProps } from 'react'

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

//// Visual configuration
interface ControlsState {
	autoRotate: {
		enabled: boolean
		speed: number
	}
}

const controlsInitialState: ControlsState = {
	autoRotate: {
		enabled: true,
		speed: 0.5
	}
}

const controlsAtom = atom<ControlsState>(controlsInitialState)

interface ENVState {
	asBackground: boolean
	backgroundIntensity: number
	exposure: number
	preset: PresetsType
	blurriness: number
	stagePreset: ComponentProps<typeof Stage>['preset']
	backgroundColor: string
}

const envInitialState: ENVState = {
	asBackground: false,
	backgroundIntensity: 1,
	exposure: 1,
	blurriness: 0.5,
	preset: 'apartment',
	stagePreset: 'soft',
	backgroundColor: 'rgba(0, 0, 0, 0)'
}

const envAtom = atom<ENVState>(envInitialState)

interface GroundState {
	showGrid: boolean
}

const groundInitialState: GroundState = {
	showGrid: false
}
const groundAtom = atom<GroundState>(groundInitialState)

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

// Create a store to manage the state of the atoms
const publisherConfigStore = createStore()

publisherConfigStore.set(metaAtom, metaInitialState)
publisherConfigStore.set(controlsAtom, controlsInitialState)
publisherConfigStore.set(envAtom, envInitialState)
publisherConfigStore.set(groundAtom, groundInitialState)
publisherConfigStore.set(processAtom, processInitialState)
publisherConfigStore.set(optimizationAtom, optimizationInitialState)

export {
	// atoms
	metaAtom,
	controlsAtom,
	envAtom,
	groundAtom,
	processAtom,
	// store
	publisherConfigStore
}
