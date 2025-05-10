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
import { Action, ModelFileTypes, ReducedGltf } from '../types'
import { arrayBufferToBase64 } from '../utils'

function useLoadGltf(dispatch: React.Dispatch<Action>) {
	const embedExternalResources = useCallback(
		async (
			gltfContent: ReducedGltf,
			otherFiles: File[],
			onProgress: (progress: number) => void
		) => {
			const fileMap = new Map(otherFiles.map((file) => [file.name, file]))
			const totalFiles =
				(gltfContent.buffers?.length || 0) + (gltfContent.images?.length || 0)
			let processedFiles = 0

			const updateProgress = () => {
				processedFiles++
				onProgress((processedFiles / totalFiles) * 100)
			}

			// Embed buffers
			if (gltfContent.buffers) {
				for (let i = 0; i < gltfContent.buffers.length; i++) {
					const buffer = gltfContent.buffers[i]
					if (!buffer.uri || buffer.uri.startsWith('data:')) {
						updateProgress()
						continue
					}

					const fileName = buffer.uri.split('/').pop() || ''
					const file = fileMap.get(fileName)
					if (file) {
						const arrayBuffer = await file.arrayBuffer()
						const base64 = await arrayBufferToBase64(arrayBuffer)
						buffer.uri = `data:application/octet-stream;base64,${base64}`
					}
					updateProgress()
				}
			}

			// Embed images
			if (gltfContent.images) {
				for (let i = 0; i < gltfContent.images.length; i++) {
					const image = gltfContent.images[i]
					if (!image.uri || image.uri.startsWith('data:')) {
						updateProgress()
						continue
					}

					const fileName = image.uri.split('/').pop() || ''
					const file = fileMap.get(fileName)
					if (file) {
						const arrayBuffer = await file.arrayBuffer()
						const base64 = await arrayBufferToBase64(arrayBuffer)
						const mimeType = file.type || 'image/png'
						image.uri = `data:${mimeType};base64,${base64}`
					}
					updateProgress()
				}
			}

			return gltfContent
		},
		[]
	)

	const loadGltf = useCallback(
		(
			gltfFile: File,
			otherFiles: File[],
			onProgress: (progress: number) => void
		) => {
			const reader = new FileReader()
			reader.onload = async (e) => {
				const gltfContent = JSON.parse(e.target?.result as string)
				onProgress(10) // Initial progress after parsing GLTF

				const modifiedGLTF = await embedExternalResources(
					gltfContent,
					otherFiles,
					(embeddingProgress) => {
						// Map embedding progress to 10-90% range
						onProgress(10 + embeddingProgress * 0.8)
					}
				)

				const gltfLoader = createGltfLoader()

				gltfLoader.parse(JSON.stringify(modifiedGLTF), '', (gltf) => {
					dispatch({
						type: 'set-file',
						payload: {
							model: gltf.scene,
							type: ModelFileTypes.gltf,
							name: gltfFile.name
						}
					})
				})

				onProgress(100) // Final progress
				dispatch({ type: 'set-file-loading', payload: false })
			}

			reader.readAsText(gltfFile)
		},
		[dispatch, embedExternalResources]
	)

	return { loadGltf }
}

export default useLoadGltf
