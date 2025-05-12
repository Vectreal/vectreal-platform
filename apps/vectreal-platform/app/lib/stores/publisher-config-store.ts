import { Stage } from '@react-three/drei'
import { PresetsType } from '@react-three/drei/helpers/environment-assets'
import { atomWithReset, atomWithStorage } from 'jotai/utils'
import { atom, createStore } from 'jotai/vanilla'
import { ComponentProps } from 'react'

interface InfoState {
	sceneName: string
	isSaved: boolean
}

const infoInitialState: InfoState = {
	sceneName: '',
	isSaved: true
}
const infoAtom = atomWithReset<InfoState>(infoInitialState)

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

export interface OptimizationState {
	textures: {
		size: number
		quality: number
		format: 'jpg' | 'png'
	}
}

// Create a store to manage the state of the atoms
const publisherConfigStore = createStore()

publisherConfigStore.set(infoAtom, infoInitialState)
publisherConfigStore.set(controlsAtom, controlsInitialState)
publisherConfigStore.set(envAtom, envInitialState)
publisherConfigStore.set(groundAtom, groundInitialState)
publisherConfigStore.set(processAtom, processInitialState)

export {
	// atoms
	infoAtom,
	controlsAtom,
	envAtom,
	groundAtom,
	processAtom,
	// store
	publisherConfigStore
}
