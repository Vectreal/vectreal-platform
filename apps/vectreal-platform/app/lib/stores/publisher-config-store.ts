import { atom } from 'jotai'
import { selectAtom } from 'jotai/utils'

import type { SceneCurrentLocation } from '../../types/api'
import type { ProcessState, SceneMetaState } from '../../types/publisher-config'
import type { SaveLocationTarget } from '../../types/publisher-scene'
import type { SceneSettings } from '@vctrl/core'

/**
 * Publisher UI preferences. Deliberately holds no load lifecycle: whether a
 * model is on screen, arriving, or failed is the loader's `status`, and keeping
 * a second copy here is what used to let the chrome and the canvas disagree.
 */
const processInitialState: ProcessState = {
	mode: 'optimize',
	activeComposeTool: 'environment',
	showSidebar: false,
	showPublishPanel: false,
	isSaving: false,
	hasUnsavedChanges: false
}
const sceneMetaInitialState: SceneMetaState = {
	name: '',
	description: '',
	thumbnailUrl: ''
}
const processAtom = atom<ProcessState>(processInitialState)
// Deliberately not persisted. A second publisher tab writing the same storage
// key would blank this tab's name and thumbnail mid-edit.
const sceneMetaAtom = atom<SceneMetaState>(sceneMetaInitialState)

// Last-saved baselines. Atoms rather than component state so they survive a
// route transition between /publisher and /publisher/:sceneId, which does not
// remount the page.
const lastSavedSettingsAtom = atom<SceneSettings | null>(null)
const lastSavedSceneMetaAtom = atom<SceneMetaState | null>(null)

// The scene ID most recently committed to the DB. The publish panel reads it so
// its actions target the just-saved scene during the window before the route
// param catches up, rather than triggering a second save.
const lastSavedSceneIdAtom = atom<string | null>(null)

// The scene the publisher is editing. Seeded from the route and cleared when a
// dropped file starts a new unsaved scene, which is what keeps first-save
// gating deterministic after a previous upload was saved.
const currentSceneIdAtom = atom<string | null>(null)

// Save location atoms - not persisted to storage, initialized from loader data each session
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

/**
 * The organization's per-scene byte limit (storage_bytes_per_scene), seeded from
 * the publisher loader. `null` means unlimited (or an unauthenticated guest).
 */
const maxSceneBytesAtom = atom<number | null>(null)

const showSidebarAtom = selectAtom(processAtom, (state) => state.showSidebar)

const toolSidebarStateAtom = selectAtom(
	processAtom,
	(state) => ({
		activeComposeTool: state.activeComposeTool,
		mode: state.mode,
		showSidebar: state.showSidebar
	}),
	(a, b) =>
		a.activeComposeTool === b.activeComposeTool &&
		a.mode === b.mode &&
		a.showSidebar === b.showSidebar
)

/**
 * The compose tool whose panel is actually open, or null when none is.
 *
 * `activeComposeTool` on its own answers a different question: which tool is
 * *selected*. It is never null, it defaults to `environment` before the author
 * has opened anything, and closing a drawer flips `showSidebar` while leaving it
 * exactly where it was. So a scene affordance that reads it directly stays live
 * after the tool that owns it has closed - the tool rail stops highlighting the
 * button while the canvas goes on offering the tool's gizmo.
 *
 * That predicate already existed twice, written by hand: the rail's own
 * `value === activeComposeTool && showSidebar`, and the shadow light handle's
 * copy of it. The hotspot editor wrote a third version that omitted
 * `showSidebar`, which is exactly the drift a shared derivation prevents. Scene
 * affordances read this; nothing reads `activeComposeTool` to mean "active".
 *
 * `mode` is in the test because these are *compose* tools: leaving optimize mode
 * showing a compose tool's in-scene handles is the same category of leak.
 */
const activeComposeToolAtom = selectAtom(processAtom, (state) =>
	state.mode === 'compose' && state.showSidebar ? state.activeComposeTool : null
)

const showPublishPanelAtom = selectAtom(
	processAtom,
	(state) => state.showPublishPanel
)

const isSavingAtom = selectAtom(processAtom, (state) => state.isSaving)
const hasUnsavedChangesAtom = selectAtom(
	processAtom,
	(state) => state.hasUnsavedChanges
)

// Editor mode atoms - not persisted, reset on each session
const isPreviewModeAtom = atom(false)
const isClickToPlaceActiveAtom = atom(false)
const arePublisherActionsDisabledAtom = atom((get) => get(isPreviewModeAtom))
const canEditCameraSettingsAtom = atom(
	(get) => !get(arePublisherActionsDisabledAtom)
)

export {
	// atoms
	processAtom,
	currentSceneIdAtom,
	sceneMetaAtom,
	saveLocationAtom,
	currentLocationAtom,
	maxSceneBytesAtom,
	showSidebarAtom,
	toolSidebarStateAtom,
	activeComposeToolAtom,
	showPublishPanelAtom,
	isSavingAtom,
	hasUnsavedChangesAtom,
	isPreviewModeAtom,
	isClickToPlaceActiveAtom,
	arePublisherActionsDisabledAtom,
	canEditCameraSettingsAtom,
	lastSavedSettingsAtom,
	lastSavedSceneMetaAtom,
	lastSavedSceneIdAtom,
	processInitialState,
	sceneMetaInitialState
}
