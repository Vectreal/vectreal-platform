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

import { createGltfLoader } from '../loaders'
import { Action, ModelFileTypes } from '../types'

function useLoadGltf(dispatch: React.Dispatch<Action>) {
	const loadGltf = useCallback(
		(
			gltfFile: File,
			otherFiles: File[],
			onProgress: (progress: number) => void
		) => {
			const reader = new FileReader()

			reader.onload = async (e) => {
				try {
					onProgress(10) // Initial progress after parsing GLTF

					// Create blob map only for external files (textures, buffers, etc.)
					const fileEntries = await Promise.all(
						otherFiles.map(
							async (file): Promise<[string, Blob]> => [
								file.name,
								new Blob([await file.arrayBuffer()])
							]
						)
					)

					const [gltfLoader, blobUrls] = createGltfLoader(new Map(fileEntries))

					// Load GLTF directly using parse method with the file content
					const gltfArrayBuffer = await gltfFile.arrayBuffer()

					gltfLoader.parse(
						gltfArrayBuffer,
						'',
						(gltf) => {
							console.log('GLTF loaded successfully:', gltf)
							dispatch({
								type: 'set-file',
								payload: {
									model: gltf.scene,
									type: ModelFileTypes.gltf,
									name: gltfFile.name
								}
							})

							// Clean up blob URLs
							blobUrls.forEach((url) => URL.revokeObjectURL(url))

							onProgress(100) // Final progress
							dispatch({ type: 'set-file-loading', payload: false })
						},
						(error) => {
							console.error('Error loading GLTF:', error)
							dispatch({ type: 'set-file-loading', payload: false })
						}
					)
				} catch (error) {
					console.error('Error parsing GLTF file:', error)
					dispatch({ type: 'set-file-loading', payload: false })
				}
			}

			reader.readAsText(gltfFile)
		},
		[dispatch]
	)

	return { loadGltf }
}

export default useLoadGltf
