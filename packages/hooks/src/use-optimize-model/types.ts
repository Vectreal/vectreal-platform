import { OptimizationReport } from '@vctrl/core'

interface ModelTotals {
	verticesCount: number
	primitivesCount: number
	texturesSize: number
	meshesSize: number
	sceneBytes: number
}

export interface OptimizationInfo {
	initial: ModelTotals
	optimized: ModelTotals
	improvement: ModelTotals
}

/**
 * Interface representing the state of the model optimizer.
 */
export interface OptimizationState {
	model: Uint8Array | null // Store optimized model as binary data
	report: OptimizationReport | null
	info: OptimizationInfo | null
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
			payload: { model: Uint8Array; report: OptimizationReport }
	  }
	| { type: 'LOAD_ERROR'; payload: Error }
	| { type: 'RESET' }
