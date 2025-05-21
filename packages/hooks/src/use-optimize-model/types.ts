import { Document } from '@gltf-transform/core'
import { InspectReport } from '@gltf-transform/functions'

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
	model: Document | null
	report: InspectReport | null
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
			payload: { model: Document; report: InspectReport }
	  }
	| { type: 'LOAD_ERROR'; payload: Error }
	| { type: 'RESET' }
