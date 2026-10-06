import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'

import {
	DEFAULT_PRESET_ID,
	optimizationPresets,
	originalPreset
} from '../../constants/optimizations'

import type {
	KeptOriginalState,
	SceneOptimizationModalState,
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../../types/scene-optimization'

const optimizationInitialState: OptimizationState = {
	optimizations: optimizationPresets[DEFAULT_PRESET_ID],
	optimizationPreset: DEFAULT_PRESET_ID,
	sourceSettings: originalPreset,
	derivedFrom: originalPreset
}

const optimizationRuntimeInitialState: SceneOptimizationRuntimeState = {
	isPending: false,
	isSceneSizeLoading: false,
	optimizedSceneBytes: null,
	clientSceneBytes: null,
	workingSceneBytes: null,
	optimizedTextureBytes: null,
	clientTextureBytes: null,
	lastSavedReportSignature: null,
	latestSceneStats: null,
	dracoReport: null,
	publishedEncoding: null,
	passRevision: 0
}

const optimizationModalInitialState: SceneOptimizationModalState = {
	isOpen: false,
	source: null
}

const optimizationAtom = atomWithReset<OptimizationState>(
	optimizationInitialState
)

/**
 * The settings that describe the document on screen, which is what a save, a
 * draft and the publish-time Draco repack must act on.
 */
const documentOptimizationsAtom = atom(
	(get) => get(optimizationAtom).derivedFrom
)

const optimizationRuntimeAtom = atomWithReset<SceneOptimizationRuntimeState>(
	optimizationRuntimeInitialState
)

const keptOriginalInitialState: KeptOriginalState = {
	keep: true,
	stored: null,
	saved: false,
	unreadable: false
}

const keptOriginalAtom = atom<KeptOriginalState>(keptOriginalInitialState)

const optimizationModalAtom = atomWithReset<SceneOptimizationModalState>(
	optimizationModalInitialState
)

export {
	documentOptimizationsAtom,
	keptOriginalAtom,
	keptOriginalInitialState,
	optimizationModalAtom,
	optimizationModalInitialState,
	optimizationAtom,
	optimizationInitialState,
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState
}
