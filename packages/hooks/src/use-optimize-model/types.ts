import type { OptimizationReport } from '@vctrl/core/model-optimizer'

interface ModelTotals {
	verticesCount: number
	primitivesCount: number
	texturesCount: number
	meshesCount: number
	sceneBytes: number
}

export interface OptimizationInfo {
	initial: ModelTotals
	optimized: ModelTotals
	improvement: ModelTotals
}

/**
 * Interface representing the state of the model optimizer.
 *
 * `OptimizationInfo` is not part of it: it is derived from `report` on every
 * render by `useCalcOptimizationInfo`, never stored.
 */
export interface OptimizationState {
	report: OptimizationReport | null
	error: Error | null
	loading: boolean
}

/**
 * Types of actions for the reducer.
 */
export type Action =
	| { type: 'LOAD_START' }
	| {
			type: 'LOAD_SUCCESS'
			payload: { report: OptimizationReport }
	  }
	| { type: 'LOAD_ERROR'; payload: Error }
	| { type: 'RESET' }
