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

import { useCallback } from 'react'

import { createGltfLoader, createUsdzLoader } from '../loaders'
import { Action, ModelFileTypes } from '../types'

/**
 * Hook to load binary files
 *
 * @param dispatch - The dispatch function from the useReducer hook
 * @returns An object containing the loadBinary function
 */
function useLoadBinary(dispatch: React.Dispatch<Action>) {
	/**
	 * Function to read binary files
	 *
	 * @param file - The binary file to read
	 * @param fileType - The type of file to read
	 * @param onProgress - The function to call when progress is made
	 * @returns {void}
	 */
	const loadBinary = useCallback(
		(file: File, fileType: ModelFileTypes, onProgress: () => void) => {
			const reader = new FileReader()

			reader.onload = async (event: ProgressEvent<FileReader>) => {
				if (event.target?.result) {
					const arrayBuffer = event.target.result as ArrayBuffer

					if (fileType === ModelFileTypes.glb) {
						const gltfLoader = createGltfLoader()

						gltfLoader.parse(arrayBuffer, '', (gltf) => {
							dispatch({
								type: 'set-file',
								payload: {
									model: gltf.scene,
									type: ModelFileTypes.glb,
									name: file.name
								}
							})
						})
					} else if (fileType === ModelFileTypes.usdz) {
						const usdzLoader = createUsdzLoader()
						const model = usdzLoader.parse(arrayBuffer)

						dispatch({
							type: 'set-file',
							payload: {
								model: model,
								type: ModelFileTypes.usdz,
								name: file.name
							}
						})
					}

					onProgress() // Call progress callback when binary file is loaded
					dispatch({ type: 'set-file-loading', payload: false })
				}
			}

			reader.onerror = (error) => {
				console.error('Error reading file:', error)
				dispatch({ type: 'set-file-loading', payload: false })
			}

			reader.readAsArrayBuffer(file)
		},
		[dispatch]
	)

	return { loadBinary }
}

export default useLoadBinary
