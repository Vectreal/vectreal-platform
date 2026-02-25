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

import { ModelFileTypes, ModelLoader } from '@vctrl/core/model-loader'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { Object3D } from 'three'

import eventSystem from './event-system'
import reducer, { initialState } from './state'
import {
	Action,
	InputFileOrDirectory,
	ModelFile,
	SceneDataLoadOptions,
	OptimizerIntegrationReturn,
	SceneLoadOptions,
	SceneLoadResult,
	ServerSceneData,
	UseLoadModelReturn
} from './types'
import {
	calculateReferencedBytesFromFiles,
	calculateReferencedBytesFromServerScene,
	readDirectory,
	reconstructGltfFiles
} from './utils'
import { ServerCommunicationService } from '../utils/server-communication'

import type { useOptimizeModel } from '../use-optimize-model'
import type { OperationProgress } from '@vctrl/core'

/**
 * Custom hook to load and manage 3D models with optional optimization integration.
 *
 * This hook provides a complete solution for loading 3D models (GLTF, GLB, USDZ) with
 * optional integration of model optimization capabilities. The return type is conditionally
 * typed based on whether an optimizer is provided.
 *
 * **Type Safety:**
 * - When called with an optimizer: `optimizer` property is fully typed with optimization methods
 * - When called without an optimizer: `optimizer` property is typed as `null`
 *
 * @example
 * // With optimizer integration
 * const optimizer = useOptimizeModel()
 * const model = useLoadModel(optimizer)
 * model.optimizer.applyOptimization() // ✅ Fully typed
 *
 * @example
 * // Without optimizer
 * const model = useLoadModel()
 * model.optimizer // ✅ Typed as null
 *
 * @template T - The type of the optimizer parameter (inferred automatically)
 * @param optimizer - Optional optimizer hook returned from useOptimizeModel
 * @returns Model loading state and methods, with conditionally typed optimizer property
 */
function useLoadModel<
	T extends ReturnType<typeof useOptimizeModel> | undefined
>(optimizer?: T): UseLoadModelReturn<T extends undefined ? false : true> {
	const uploadCompleteRef = useRef(false)
	const loadedFileRef = useRef<ModelFile | null>(null)
	const [state, dispatch] = useReducer(reducer, initialState)

	// Create ModelLoader instance with progress tracking
	const modelLoader = useMemo(() => {
		const loader = new ModelLoader()

		// Set up progress callback to update state and emit events
		loader.onProgress((progress: OperationProgress) => {
			dispatch({ type: 'set-progress', payload: progress.progress })
			// FInal load progress is set to 100% elsewhere
			if (progress.progress === 100) return
			eventSystem.emit('load-progress', progress.progress)
		})

		return loader
	}, [])

	/**
	 * Helper function to find a specific file type from an array of files.
	 * Used to identify model files (GLTF, GLB, USDZ) from uploaded file lists.
	 */
	const getFileOfType = useCallback(
		(files: File[], fileType: ModelFileTypes) =>
			files.find((file) => file.name.endsWith('.' + fileType)),
		[]
	)

	/**
	 * Updates the loading progress state and emits a progress event.
	 * Called during file upload and model loading operations.
	 */
	const updateProgress = useCallback((progress: number) => {
		dispatch({ type: 'set-progress', payload: progress })
		eventSystem.emit('load-progress', progress)
	}, [])

	/**
	 * Resets the model loading state to initial values.
	 * Clears any loaded models, progress, and emits a reset event.
	 */
	const reset = useCallback(() => {
		dispatch({ type: 'reset-state' })
		eventSystem.emit('load-reset')
	}, [])

	/**
	 * Loads binary model files (GLB, USDZ) into Three.js scene.
	 * Handles errors and updates loading state.
	 */
	const loadBinaryModel = useCallback(
		async (file: File, fileType: ModelFileTypes) => {
			try {
				const result = await modelLoader.loadToThreeJS(file)

				dispatch({
					type: 'set-file',
					payload: {
						model: result.scene,
						type: fileType,
						name: file.name
					}
				})

				dispatch({ type: 'set-file-loading', payload: false })
			} catch (error) {
				console.error('Error loading binary model:', error)
				dispatch({ type: 'set-file-loading', payload: false })
				eventSystem.emit('load-error', error)
			}
		},
		[modelLoader]
	)

	/**
	 * Loads GLTF models with their associated assets (textures, bins, etc.).
	 * Handles the more complex GLTF format with external resources.
	 */
	const loadGltfModel = useCallback(
		async (gltfFile: File, otherFiles: File[]) => {
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

				dispatch({
					type: 'set-file',
					payload: loadedFile
				})

				dispatch({ type: 'set-file-loading', payload: false })

				// Update the ref so loadFromServer can access it
				loadedFileRef.current = loadedFile
			} catch (error) {
				console.error('Error loading GLTF model:', error)
				console.error('GLTF file:', gltfFile.name)
				console.error(
					'Asset files:',
					otherFiles.map((f) => f.name)
				)
				dispatch({ type: 'set-file-loading', payload: false })
				eventSystem.emit('load-error', error)
			}
		},
		[modelLoader]
	)

	/**
	 * Processes an array of files to identify and load supported 3D model formats.
	 * Validates that only one model file is present and emits appropriate events.
	 *
	 * Supported formats: GLTF, GLB, USDZ
	 * Emits events for: multiple models found, no supported files found
	 */
	const processFiles = useCallback(
		async (files: File[]) => {
			if (files.length === 0) return

			// Identify model files by type
			const gltfFile = getFileOfType(files, ModelFileTypes.gltf)
			const glbFile = getFileOfType(files, ModelFileTypes.glb)
			const usdzFile = getFileOfType(files, ModelFileTypes.usdz)

			const supportedFiles = [gltfFile, glbFile, usdzFile].filter(
				Boolean
			) as File[]

			// Emit error if multiple model files are found
			if (supportedFiles.length > 1) {
				eventSystem.emit('multiple-models', supportedFiles)
				return
			}

			// Separate model file from asset files (textures, bins, etc.)
			const otherFiles = files.filter(
				(file) => file !== gltfFile && file !== glbFile && file !== usdzFile
			)

			// Mark upload as complete (progress is already emitted by ModelLoader)
			const markUploadComplete = () => {
				uploadCompleteRef.current = true
			}

			// Load the appropriate model type
			if (gltfFile) {
				await loadGltfModel(gltfFile, otherFiles)
				markUploadComplete()
			} else if (glbFile) {
				await loadBinaryModel(glbFile, ModelFileTypes.glb)
				markUploadComplete()
			} else if (usdzFile) {
				await loadBinaryModel(usdzFile, ModelFileTypes.usdz)
				markUploadComplete()
			} else {
				// No supported model files found
				eventSystem.emit('not-loaded-files', files)
				dispatch({ type: 'set-file-loading', payload: false })
				return
			}
		},
		[getFileOfType, loadGltfModel, loadBinaryModel]
	)

	/**
	 * Main function to load 3D models from files or directories.
	 * Accepts both File objects and FileSystemDirectoryHandle for folder uploads.
	 * Resets state, processes all files, and integrates with optimizer if available.
	 *
	 * @param filesOrDirectories - Array of File objects or FileSystemDirectoryHandle objects
	 */
	const load = useCallback(
		async (filesOrDirectories: InputFileOrDirectory): Promise<void> => {
			const allFiles: File[] = []

			// Emit load start event and reset state
			eventSystem.emit('load-start')
			dispatch({ type: 'reset-state' })
			dispatch({ type: 'set-file-loading', payload: true })

			updateProgress(0)
			uploadCompleteRef.current = false

			// Process both files and directories
			for (const item of filesOrDirectories) {
				if (item instanceof File) {
					allFiles.push(item)
				} else if ('kind' in item && item.kind === 'directory') {
					// Recursively read directory contents
					const directoryFiles = await readDirectory(item)
					allFiles.push(...directoryFiles)
				}
			}

			await processFiles(allFiles)
		},
		[processFiles, updateProgress]
	)

	/**
	 * Load a scene from the server by scene ID.
	 * Fetches the GLTF JSON and asset data, reconstructs files, then loads them.
	 *
	 * This function:
	 * 1. Emits 'server-load-start' event with the sceneId
	 * 2. Fetches scene data from the configured endpoint
	 * 3. Reconstructs GLTF and asset files from the server data
	 * 4. Loads the files into Three.js directly (bypassing processFiles to avoid double-loading)
	 * 5. Emits 'server-load-complete' event with the full result
	 *
	 * @param options - Scene loading configuration
	 * @returns Promise resolving to the loaded scene data with settings
	 */
	const loadFromData = useCallback(
		async (options: SceneDataLoadOptions): Promise<SceneLoadResult> => {
			const { sceneData } = options

			// Update progress to 40% after data resolution
			updateProgress(40)

			// Reconstruct GLTF and asset files from scene data
			const files = reconstructGltfFiles(sceneData)
			const { sourcePackageBytes, textureBytes } =
				calculateReferencedBytesFromServerScene(sceneData)

			// Update progress to 60% after reconstruction
			updateProgress(60)

			const gltfFile = files[0] as File
			const otherFiles = files.slice(1) as File[]

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

			dispatch({
				type: 'set-file',
				payload: loadedFile
			})

			dispatch({ type: 'set-file-loading', payload: false })
			loadedFileRef.current = loadedFile

			updateProgress(100)

			return {
				file: loadedFile,
				...sceneData
			}
		},
		[modelLoader, updateProgress]
	)

	const loadFromServer = useCallback(
		async (options: SceneLoadOptions): Promise<SceneLoadResult> => {
			const { sceneId, serverOptions } = options

			try {
				// Emit server load start event
				eventSystem.emit('server-load-start', sceneId)

				// Reset state and set loading
				dispatch({ type: 'reset-state' })
				dispatch({ type: 'set-file-loading', payload: true })
				updateProgress(0)

				const sceneData =
					await ServerCommunicationService.loadScene<ServerSceneData>(
						sceneId,
						serverOptions
					)

				const sceneLoadResult = await loadFromData({
					sceneData
				})

				// If optimizer is available, load the model into it
				if (optimizer && sceneLoadResult.file?.model) {
					await optimizer.load(sceneLoadResult.file.model as Object3D)
				}

				// Emit server load complete event
				eventSystem.emit('server-load-complete', sceneLoadResult)

				return sceneLoadResult
			} catch (error) {
				console.error('Server scene loading failed:', error)
				dispatch({ type: 'set-file-loading', payload: false })

				// Emit error event
				eventSystem.emit('server-load-error', error)

				// Re-throw for caller to handle
				throw error
			}
		},
		[optimizer, loadFromData, updateProgress]
		// Note: processFiles removed, we load directly to avoid uploadCompleteRef trigger
	)

	/**
	 * Effect to integrate loaded models with the optimizer (if provided).
	 * When a model is successfully loaded and optimizer is available,
	 * automatically loads the model into the optimizer for processing.
	 */
	useEffect(() => {
		if (uploadCompleteRef.current && state.file) {
			// Emit load complete event
			eventSystem.emit('load-complete', state.file)
			uploadCompleteRef.current = false

			// If optimizer is available, load the model into it
			if (optimizer && state.file.model) {
				optimizer.load(state.file.model)
			}
		}
	}, [state.file, optimizer])

	/**
	 * Creates the optimizer integration object.
	 * This provides additional methods for applying optimizations and
	 * updating the loaded model with optimized versions.
	 *
	 * Returns null if no optimizer is provided, otherwise returns
	 * the full optimizer interface with applyOptimization method.
	 */
	const optimizerIntegration = useOptimizerIntegration(
		optimizer,
		dispatch,
		state.file,
		modelLoader
	)

	return {
		...state,
		on: eventSystem.on,
		off: eventSystem.off,
		load,
		loadFromServer,
		reset,
		optimizer: optimizerIntegration
	} as UseLoadModelReturn<T extends undefined ? false : true>
}

/**
 * Hook to integrate the optimizer into the model loading process.
 *
 * @param instance - The optimizer instance.
 * @param dispatch - The dispatch function from useReducer.
 * @param file - The current model file.
 * @param modelLoader - The ModelLoader instance.
 * @returns An object containing optimization functions and optimizer states.
 */
function useOptimizerIntegration(
	instance: ReturnType<typeof useOptimizeModel> | undefined,
	dispatch: React.Dispatch<Action>,
	file: ModelFile | null,
	modelLoader: ModelLoader
): OptimizerIntegrationReturn<boolean> {
	/**
	 * Applies an optimization to the current model and loads the result.
	 *
	 * This function:
	 * 1. Runs the provided optimization function (e.g., simplify, compress)
	 * 2. Retrieves the optimized model as a binary file
	 * 3. Loads the optimized binary into a Three.js scene
	 * 4. Updates the model state with the optimized version
	 *
	 * @template TOptions - The type of options for the optimization function
	 * @param optimizationFunction - Optional function to run optimization (e.g., instance.simplifyOptimization)
	 * @param options - Optional configuration for the optimization function
	 */
	const applyOptimization = useCallback(
		async <TOptions>(
			optimizationFunction?:
				| ((options?: TOptions) => Promise<void>)
				| undefined,
			options?: TOptions
		) => {
			if (!instance) {
				console.warn('Optimizer is not available')
				return
			}

			try {
				// Step 1: Apply the optimization with optional parameters
				if (optimizationFunction) await optimizationFunction(options)

				// Step 2: Get the optimized model as a binary file
				const optimizedModel = await instance.getModel()
				if (!optimizedModel) {
					console.warn('No optimized model available after optimization')
					return
				}

				// Step 3: Create a File object from the optimized binary data
				// Ensure we pass an ArrayBufferView (Uint8Array) backed by a real ArrayBuffer
				// to the File constructor to satisfy BlobPart typing and avoid SharedArrayBuffer issues.
				// We create a copy using .slice() which returns a Uint8Array backed by a standard ArrayBuffer.
				const optimizedBlobPart =
					optimizedModel instanceof Uint8Array
						? optimizedModel.slice()
						: new Uint8Array(optimizedModel as ArrayBufferLike).slice()

				const optimizedFile = new File(
					[optimizedBlobPart],
					file?.name || 'optimized_model.glb',
					{
						type: 'model/gltf-binary'
					}
				)

				// Step 4: Load the optimized file into Three.js
				const result = await modelLoader.loadToThreeJS(optimizedFile)

				// Step 5: Update the state with the optimized model
				dispatch({
					type: 'set-file',
					payload: {
						model: result.scene,
						type: ModelFileTypes.glb,
						name: optimizedFile.name
					}
				})
			} catch (error) {
				console.error('Optimization failed:', error)
				// Error is logged, state remains unchanged
			}
		},
		[instance, modelLoader, file, dispatch]
	)

	// Return null if no optimizer instance is provided
	if (!instance) return null as OptimizerIntegrationReturn<boolean>

	// Return the full optimizer interface with the applyOptimization method
	return {
		...instance,
		applyOptimization,
		reset: instance?.reset,
		error: instance?.error,
		loading: instance?.loading
	} as OptimizerIntegrationReturn<boolean>
}
export default useLoadModel
