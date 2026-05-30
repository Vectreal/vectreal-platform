import { ModelFileTypes, ModelLoader } from '@vctrl/core/model-loader'
import React from 'react'

import { normalizeLocalLoadError } from './error-helpers'
import eventSystem from './event-system'
import { buildSceneDataFromLocalFiles } from './scene-data-builder'
import { Action, ModelFile } from './types'

import type { useOptimizeModel } from '../use-optimize-model'

type Optimizer = ReturnType<typeof useOptimizeModel> | undefined
type Dispatch = React.Dispatch<Action>

export const loadBinaryModel = async (
	file: File,
	fileType: ModelFileTypes,
	modelLoader: ModelLoader,
	optimizer: Optimizer,
	dispatch: Dispatch
): Promise<ModelFile | null> => {
	try {
		const result = await modelLoader.loadToThreeJS(file)
		const loadedFile: ModelFile = {
			model: result.scene,
			type: fileType,
			name: file.name
		}

		dispatch({ type: 'set-file', payload: loadedFile })
		dispatch({ type: 'set-file-loading', payload: false })

		if (optimizer) {
			const buffer = new Uint8Array(await file.arrayBuffer())
			await optimizer.loadFromGlbBuffer(buffer)
		}

		return loadedFile
	} catch (error) {
		console.error('Error loading binary model:', error)
		dispatch({ type: 'set-file-loading', payload: false })
		eventSystem.emit(
			'load-error',
			normalizeLocalLoadError(error, 'binary_load_failed', {
				fileName: file.name,
				fileType,
				fileSize: file.size
			})
		)
		return null
	}
}

export const loadGltfModel = async (
	gltfFile: File,
	otherFiles: File[],
	modelLoader: ModelLoader,
	optimizer: Optimizer,
	dispatch: Dispatch,
	calculateReferencedBytesFromFiles: (
		gltfFile: File,
		otherFiles: File[]
	) => Promise<{ sourcePackageBytes: number; textureBytes: number }>
): Promise<ModelFile | null> => {
	try {
		const { sourcePackageBytes, textureBytes } =
			await calculateReferencedBytesFromFiles(gltfFile, otherFiles)

		const result = await modelLoader.loadGLTFWithAssetsToThreeJS(
			gltfFile,
			otherFiles
		)

		const loadedFile: ModelFile = {
			model: result.scene,
			type: ModelFileTypes.gltf,
			name: gltfFile.name,
			sourcePackageBytes,
			sourceTextureBytes: textureBytes
		}

		dispatch({ type: 'set-file', payload: loadedFile })
		dispatch({ type: 'set-file-loading', payload: false })

		if (optimizer) {
			try {
				const localSceneData = await buildSceneDataFromLocalFiles(
					gltfFile,
					otherFiles
				)
				await optimizer.loadFromServerSceneData(localSceneData)
			} catch (optimizerError) {
				console.warn(
					'Failed to initialize optimizer from source GLTF payload; trying direct asset load.',
					optimizerError
				)
				try {
					if ('loadFromGLTFWithAssets' in optimizer) {
						const gltfBytes = new Uint8Array(await gltfFile.arrayBuffer())
						const assetMap = new Map<string, Uint8Array>()
						for (const assetFile of otherFiles) {
							const bytes = new Uint8Array(await assetFile.arrayBuffer())
							assetMap.set(assetFile.name, bytes)
							if (assetFile.webkitRelativePath) {
								assetMap.set(assetFile.webkitRelativePath, bytes)
							}
						}
						await optimizer.loadFromGLTFWithAssets(gltfBytes, assetMap)
					} else {
						throw new Error('loadFromGLTFWithAssets not available')
					}
				} catch (fallbackError) {
					console.warn(
						'Direct asset load also failed; falling back to Three.js scene import. Texture names may be generic.',
						fallbackError
					)
					await optimizer.load(result.scene)
				}
			}
		}

		return loadedFile
	} catch (error) {
		console.error('Error loading GLTF model:', error)
		console.error('GLTF file:', gltfFile.name)
		console.error(
			'Asset files:',
			otherFiles.map((f) => f.name)
		)
		dispatch({ type: 'set-file-loading', payload: false })
		eventSystem.emit(
			'load-error',
			normalizeLocalLoadError(error, 'gltf_load_failed', {
				fileName: gltfFile.name,
				fileSize: gltfFile.size,
				assetCount: otherFiles.length
			})
		)
		return null
	}
}
