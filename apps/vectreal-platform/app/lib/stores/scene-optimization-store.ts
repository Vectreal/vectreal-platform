import { atomWithReset } from 'jotai/utils'
import { createStore } from 'jotai/vanilla'

import { mediumPreset } from '../../constants/optimizations'

import type {
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../../types/scene-optimization'

const optimizationInitialState: OptimizationState = {
	optimizations: mediumPreset,
	optimizationPreset: 'medium'
}

const optimizationRuntimeInitialState: SceneOptimizationRuntimeState = {
	isPending: false,
	optimizedSceneBytes: null,
	clientSceneBytes: null,
	optimizedTextureBytes: null,
	clientTextureBytes: null,
	lastSavedReportSignature: null,
	latestSceneStats: null
}

const optimizationAtom = atomWithReset<OptimizationState>(
	optimizationInitialState
)

const optimizationRuntimeAtom = atomWithReset<SceneOptimizationRuntimeState>(
	optimizationRuntimeInitialState
)

const sceneOptimizationStore = createStore()

sceneOptimizationStore.set(optimizationAtom, optimizationInitialState)
sceneOptimizationStore.set(
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState
)

export {
	optimizationAtom,
	optimizationInitialState,
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState,
	sceneOptimizationStore
}
