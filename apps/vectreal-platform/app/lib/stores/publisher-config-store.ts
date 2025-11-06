import { atomWithReset, atomWithStorage } from 'jotai/utils'
import { createStore } from 'jotai/vanilla'

import { mediumPreset } from '../../constants/optimizations'
import type {
	OptimizationState,
	ProcessState
} from '../../types/publisher-config'

const processInitialState: ProcessState = {
	step: 'uploading',
	mode: 'optimize',
	showSidebar: false,
	showInfo: false,
	isLoading: false,
	isInitializing: false,
	hasUnsavedChanges: false
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

// Create a store to manage the state of the atoms
const publisherConfigStore = createStore()

publisherConfigStore.set(processAtom, processInitialState)
publisherConfigStore.set(optimizationAtom, optimizationInitialState)

export {
	// atoms
	processAtom,
	optimizationAtom,

	// store
	publisherConfigStore
}
