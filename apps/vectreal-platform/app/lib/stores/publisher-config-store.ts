import { atomWithStorage } from 'jotai/utils'
import { createStore } from 'jotai/vanilla'

import type { ProcessState } from '../../types/publisher-config'

const processInitialState: ProcessState = {
	step: 'uploading',
	mode: 'optimize',
	showSidebar: false,
	showInfo: false,
	isInitializing: false,
	isLoading: false,
	isSaving: false,
	hasUnsavedChanges: false
}
const processAtom = atomWithStorage<ProcessState>(
	'publisher-process',
	processInitialState
)

// Create a store to manage the state of the atoms
const publisherConfigStore = createStore()

publisherConfigStore.set(processAtom, processInitialState)

export {
	// atoms
	processAtom,

	// store
	publisherConfigStore
}
