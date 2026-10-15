import { SupersededError } from '@vctrl/core/model-optimizer'

import { Action, OptimizationState } from './types'

/**
 * Initial state for the reducer.
 */
export const initialState: OptimizationState = {
	error: null,
	loading: false,
	report: null
}

/**
 * Reducer function to manage state transitions.
 *
 * @param state - Current state.
 * @param action - Action to perform.
 * @returns New state after applying the action.
 */
export const reducer = (
	state: OptimizationState,
	action: Action
): OptimizationState => {
	switch (action.type) {
		case 'LOAD_START':
			return { ...state, loading: true, error: null }
		case 'LOAD_SUCCESS':
			return {
				...state,
				loading: false,
				report: action.payload.report
			}
		case 'LOAD_ERROR':
			// A superseded operation changed nothing, and the newer one that
			// superseded it owns `loading` until it settles.
			if (action.payload instanceof SupersededError) return state
			return { ...state, loading: false, error: action.payload }
		case 'RESET':
			return { ...initialState }
		default:
			return state
	}
}
