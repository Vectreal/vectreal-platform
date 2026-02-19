/* vectreal-core | vctrl/hooks
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

import { ModelFileTypes } from '@vctrl/core/model-loader'

import { Action, LoadData } from './types'

/**
 * Initial state for the useReadModelFiles hook
 *
 * @property file - Currently loaded file
 * @property isFileLoading - Flag indicating if a file is currently being loaded
 * @property progress - Current loading progress (0-100)
 * @property supportedFileTypes - List of supported file types
 */
export const initialState: LoadData = {
	/**
	 * Currently loaded file
	 */
	file: null,
	/**
	 * Flag indicating if a file is currently being loaded
	 */
	isFileLoading: false,
	/**
	 * Current loading progress (0-100)
	 */
	progress: 0,
	/**
	 * List of supported file types
	 * @type {ModelFileTypes[]}
	 */
	supportedFileTypes: [
		ModelFileTypes.gltf,
		ModelFileTypes.glb,
		ModelFileTypes.usdz
	]
}

/**
 * Reducer function for the useReadModelFiles hook
 *
 * @param state - The current state of the reducer
 * @param action - The action to be performed
 * @returns The updated state
 */
function reducer(state: LoadData, action: Action): LoadData {
	switch (action.type) {
		case 'set-file':
			return { ...state, file: action.payload }
		case 'set-file-loading':
			return { ...state, isFileLoading: action.payload }
		case 'set-progress':
			return { ...state, progress: action.payload }
		case 'reset-state':
			return { ...initialState }
		default:
			return state
	}
}

export default reducer
