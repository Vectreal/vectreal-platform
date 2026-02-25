import { Optimizations } from 'packages/core/src/types/scene-types'

import type { SceneStatsData } from './api'

export type OptimizationPreset = 'low' | 'medium' | 'high'

export interface OptimizationState {
	optimizations: Optimizations
	optimizationPreset: OptimizationPreset
}

export interface SceneOptimizationRuntimeState {
	isPending: boolean
	optimizedSceneBytes: null | number
	clientSceneBytes: null | number
	optimizedTextureBytes: null | number
	clientTextureBytes: null | number
	lastSavedReportSignature: null | string
	latestSceneStats: null | SceneStatsData
}
