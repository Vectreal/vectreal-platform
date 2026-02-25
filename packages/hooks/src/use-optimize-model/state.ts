import { Action, OptimizationState } from './types'

/**
 * Initial state for the reducer.
 */
export const initialState: OptimizationState = {
	info: null,
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
			return { ...state, loading: false, error: action.payload }
		case 'RESET':
			return { ...initialState }
		default:
			return state
	}
}
