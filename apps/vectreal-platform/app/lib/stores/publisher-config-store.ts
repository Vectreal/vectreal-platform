import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { selectAtom } from 'jotai/utils'
import { createStore } from 'jotai/vanilla'

import type { SaveLocationTarget } from '../../hooks/scene-loader.types'
import type { SceneCurrentLocation } from '../../types/api'
import type { ProcessState, SceneMetaState } from '../../types/publisher-config'
import type { SceneSettings } from '@vctrl/core'

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
const processAtom = atom<ProcessState>(processInitialState)
const sceneMetaAtom = atomWithStorage<SceneMetaState>(
	'publisher-scene-meta',
	sceneMetaInitialState
)

// Last-saved baselines — persisted in Jotai atoms (not React state) so they
// survive route transitions within the same publisher session without remounting.
// Cleared explicitly on full scene reset or on post-save navigation.
const lastSavedSettingsAtom = atom<SceneSettings | null>(null)
const lastSavedSceneMetaAtom = atom<SceneMetaState | null>(null)

// Tracks the scene ID that was most recently committed to the DB. Used by
// useSceneParamsSync to distinguish "post-save navigation to newId" from a
// genuine user-initiated scene change, so it can skip destructive resets.
const lastSavedSceneIdAtom = atom<string | null>(null)

// Create a store to manage the state of the atoms
const publisherConfigStore = createStore()

publisherConfigStore.set(processAtom, processInitialState)
publisherConfigStore.set(sceneMetaAtom, sceneMetaInitialState)
publisherConfigStore.set(lastSavedSettingsAtom, null)
publisherConfigStore.set(lastSavedSceneMetaAtom, null)
publisherConfigStore.set(lastSavedSceneIdAtom, null)

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

const publisherLoadingStateAtom = selectAtom(
	processAtom,
	(state) => ({
		isDownloading: state.isLoading,
		isInitializing: state.isInitializing
	}),
	(a, b) =>
		a.isDownloading === b.isDownloading && b.isInitializing === a.isInitializing
)

const showSidebarAtom = selectAtom(processAtom, (state) => state.showSidebar)

const toolSidebarStateAtom = selectAtom(
	processAtom,
	(state) => ({
		mode: state.mode,
		showSidebar: state.showSidebar
	}),
	(a, b) => a.mode === b.mode && a.showSidebar === b.showSidebar
)

const controlsOverlayStateAtom = selectAtom(
	processAtom,
	(state) => ({
		step: state.step,
		showPublishPanel: state.showPublishPanel
	}),
	(a, b) => a.step === b.step && a.showPublishPanel === b.showPublishPanel
)

const isSavingAtom = selectAtom(processAtom, (state) => state.isSaving)
const hasUnsavedChangesAtom = selectAtom(
	processAtom,
	(state) => state.hasUnsavedChanges
)

export {
	// atoms
	processAtom,
	sceneMetaAtom,
	saveLocationAtom,
	currentLocationAtom,
	publisherLoadingStateAtom,
	showSidebarAtom,
	toolSidebarStateAtom,
	controlsOverlayStateAtom,
	isSavingAtom,
	hasUnsavedChangesAtom,
	lastSavedSettingsAtom,
	lastSavedSceneMetaAtom,
	lastSavedSceneIdAtom,
	processInitialState,
	sceneMetaInitialState,

	// store
	publisherConfigStore
}
