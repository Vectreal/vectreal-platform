import { atomWithStorage } from 'jotai/utils'
import { createStore } from 'jotai/vanilla'

import type { ProcessState, SceneMetaState } from '../../types/publisher-config'

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
const sceneMetaInitialState: SceneMetaState = {
	name: '',
	description: '',
	thumbnailUrl: ''
}
const processAtom = atomWithStorage<ProcessState>(
	'publisher-process',
	processInitialState
)
const sceneMetaAtom = atomWithStorage<SceneMetaState>(
	'publisher-scene-meta',
	sceneMetaInitialState
)

// Create a store to manage the state of the atoms
const publisherConfigStore = createStore()

publisherConfigStore.set(processAtom, processInitialState)
publisherConfigStore.set(sceneMetaAtom, sceneMetaInitialState)

export {
	// atoms
	processAtom,
	sceneMetaAtom,

	// store
	publisherConfigStore
}
