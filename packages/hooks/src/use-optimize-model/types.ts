import { Document } from '@gltf-transform/core'
import { InspectReport } from '@gltf-transform/functions'

/**
 * Interface representing the size details of the model.
 */
export interface ModelSize {
	/** The file size in bytes. */
	fileSize: number
	/** The file size formatted as a human-readable string. */
	displayFileSize: string
}

/**
 * Interface representing the state of the model optimizer.
 */
export interface State {
	modelDoc: Document | null
	modelReport: InspectReport | null
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
			payload: { modelDoc: Document; modelReport: InspectReport }
	  }
	| { type: 'LOAD_ERROR'; payload: Error }
	| { type: 'RESET' }
