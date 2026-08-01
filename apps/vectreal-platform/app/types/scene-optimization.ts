import type { SceneStatsData } from './api'
import type { DracoCompressionReport, Optimizations } from '@vctrl/core'

/** Presets the user can pick. Every one of these has an entry in `optimizationPresets`. */
export type PresetId = 'quality' | 'balanced' | 'smallest'

/**
 * What the panel displays as selected. `custom` is not a preset you can pick —
 * it is what the settings resolve to once they no longer match any preset,
 * either because the user edited the advanced controls or because the scene was
 * saved under an older pipeline.
 */
export type OptimizationPreset = PresetId | 'custom'

export interface OptimizationState {
	optimizations: Optimizations
	optimizationPreset: OptimizationPreset
}

export interface SceneOptimizationRuntimeState {
	isPending: boolean
	isSceneSizeLoading: boolean
	/**
	 * Size of the scene as it will be published. With Draco enabled this is the
	 * projected compressed GLB, which is what the plan size gate and the server
	 * both end up measuring.
	 */
	optimizedSceneBytes: null | number
	clientSceneBytes: null | number
	/**
	 * Size of the uncompressed working document. Equal to `optimizedSceneBytes`
	 * unless Draco is enabled, in which case it is the larger "before Draco"
	 * figure shown as secondary detail.
	 */
	workingSceneBytes: null | number
	optimizedTextureBytes: null | number
	clientTextureBytes: null | number
	lastSavedReportSignature: null | string
	latestSceneStats: null | SceneStatsData
	/** Draco measurement from the most recent optimization pass. */
	dracoReport: null | DracoCompressionReport
}

export type OptimizationModalSource = 'initial' | 'reoptimize' | null

export interface SceneOptimizationModalState {
	isOpen: boolean
	source: OptimizationModalSource
}
