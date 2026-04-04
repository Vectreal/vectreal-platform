import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { createStore } from 'jotai/vanilla'

import type { SaveLocationTarget } from '../../hooks/scene-loader.types'
import type { SceneCurrentLocation } from '../../types/api'
import type { ProcessState, SceneMetaState } from '../../types/publisher-config'

const processInitialState: ProcessState = {
	step: 'uploading',
	mode: 'optimize',
	showSidebar: false,
	showPublishPanel: false,
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

// Save location atoms — not persisted to storage, initialized from loader data each session
const saveLocationAtom = atom<SaveLocationTarget>({
	targetProjectId: undefined,
	targetFolderId: null
})

const currentLocationAtom = atom<SceneCurrentLocation>({
	projectId: null,
	projectName: null,
	folderId: null,
	folderName: null
})

export {
	// atoms
	processAtom,
	sceneMetaAtom,
	saveLocationAtom,
	currentLocationAtom,
	processInitialState,
	sceneMetaInitialState,

	// store
	publisherConfigStore
}
