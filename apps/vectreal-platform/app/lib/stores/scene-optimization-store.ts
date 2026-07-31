import { atomWithReset } from 'jotai/utils'
import { createStore } from 'jotai/vanilla'

import {
	DEFAULT_PRESET_ID,
	optimizationPresets
} from '../../constants/optimizations'

import type {
	SceneOptimizationModalState,
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../../types/scene-optimization'

const optimizationInitialState: OptimizationState = {
	optimizations: optimizationPresets[DEFAULT_PRESET_ID],
	optimizationPreset: DEFAULT_PRESET_ID
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
	dracoReport: null
}

const optimizationModalInitialState: SceneOptimizationModalState = {
	isOpen: false,
	source: null
}

const optimizationAtom = atomWithReset<OptimizationState>(
	optimizationInitialState
)

const optimizationRuntimeAtom = atomWithReset<SceneOptimizationRuntimeState>(
	optimizationRuntimeInitialState
)

const optimizationModalAtom = atomWithReset<SceneOptimizationModalState>(
	optimizationModalInitialState
)

const sceneOptimizationStore = createStore()

sceneOptimizationStore.set(optimizationAtom, optimizationInitialState)
sceneOptimizationStore.set(
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState
)
sceneOptimizationStore.set(optimizationModalAtom, optimizationModalInitialState)

export {
	optimizationModalAtom,
	optimizationModalInitialState,
	optimizationAtom,
	optimizationInitialState,
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState,
	sceneOptimizationStore
}
