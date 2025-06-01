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

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { Object3D } from 'three'

import { useOptimizeModel } from '../use-optimize-model'

import eventSystem from './event-system'
import { useLoadBinary, useLoadGltf } from './file-type-hooks'
import { createGltfLoader } from './loaders'
import reducer, { initialState } from './state'
import {
	Action,
	InputFileOrDirectory,
	ModelFile,
	ModelFileTypes
} from './types'
import { readDirectory } from './utils'

/**
 * Custom hook to load and manage 3D models, integrating optimization functionalities.
 *
 * @param optimizer - Optional optimizer hook returned from useOptimizeModel.
 * @returns An object containing the state, event handlers, and optimization functions.
 */
function useLoadModel(optimizer?: ReturnType<typeof useOptimizeModel>) {
	const uploadCompleteRef = useRef(false)
	const [state, dispatch] = useReducer(reducer, initialState)

	const { loadGltf } = useLoadGltf(dispatch)
	const { loadBinary } = useLoadBinary(dispatch)

	const getFileOfType = useCallback(
		(files: File[], fileType: ModelFileTypes) =>
			files.find((file) => file.name.endsWith('.' + fileType)),
		[]
	)

	const updateProgress = useCallback((progress: number) => {
		dispatch({ type: 'set-progress', payload: progress })
		eventSystem.emit('load-progress', progress)
	}, [])

	const reset = useCallback(() => {
		dispatch({ type: 'reset-state' })
		eventSystem.emit('load-reset')
	}, [])

	const processFiles = useCallback(
		(files: File[]) => {
			if (files.length === 0) return

			const gltfFile = getFileOfType(files, ModelFileTypes.gltf)
			const glbFile = getFileOfType(files, ModelFileTypes.glb)
			const usdzFile = getFileOfType(files, ModelFileTypes.usdz)

			const supportedFiles = [gltfFile, glbFile, usdzFile].filter(
				Boolean
			) as File[]

			if (supportedFiles.length > 1) {
				eventSystem.emit('multiple-models', supportedFiles)
				return
			}

			const otherFiles = files.filter(
				(file) => file !== gltfFile && file !== glbFile && file !== usdzFile
			)

			const updateFileProgress = (progress: number) => {
				updateProgress(progress)

				if (progress === 100) {
					uploadCompleteRef.current = true
				}
			}

			if (gltfFile) {
				loadGltf(gltfFile, otherFiles, updateFileProgress)
			} else if (glbFile) {
				loadBinary(glbFile, ModelFileTypes.glb, () => updateFileProgress(100))
			} else if (usdzFile) {
				loadBinary(usdzFile, ModelFileTypes.usdz, () => updateFileProgress(100))
			} else {
				eventSystem.emit('not-loaded-files', files)
				dispatch({ type: 'set-file-loading', payload: false })
				return
			}
		},
		[updateProgress, getFileOfType, loadGltf, loadBinary]
	)

	const load = useCallback(
		async (filesOrDirectories: InputFileOrDirectory) => {
			const allFiles: File[] = []

			eventSystem.emit('load-start')
			dispatch({ type: 'reset-state' })
			dispatch({ type: 'set-file-loading', payload: true })

			updateProgress(0)
			uploadCompleteRef.current = false

			for (const item of filesOrDirectories) {
				if (item instanceof File) {
					allFiles.push(item)
				} else if ('kind' in item && item.kind === 'directory') {
					const directoryFiles = await readDirectory(item)
					allFiles.push(...directoryFiles)
				}
			}

			processFiles(allFiles)
		},
		[processFiles, updateProgress]
	)

	// Integration with optimizer
	useEffect(() => {
		if (uploadCompleteRef.current && state.file) {
			eventSystem.emit('load-complete', state.file)
			uploadCompleteRef.current = false

			if (optimizer && state.file.model) {
				// Load the model into the optimizer
				optimizer.load(state.file.model as Object3D)
			}
		}
	}, [state.file, optimizer])

	const optimizerIntegration = useOptimizerIntegration(
		optimizer,
		dispatch,
		state.file
	)

	return {
		...state,

		/**
		 * Add an event listener to the event system.
		 */
		on: eventSystem.on,

		/**
		 * Remove an event listener from the event system.
		 */
		off: eventSystem.off,

		/**
		 * Load a model and integrate it with the optimizer if available.
		 * This also makes the model available in the use-model-context hook.
		 */
		load,

		/**
		 * Reset the model and optimizer state to the initial state.
		 */
		reset,

		/**
		 * Integration of the optimizer
		 * An object containing functions to interact with the optimizer.
		 *
		 * It exposes the following functions:
		 *
		 * - `simplifyOptimization(options?: SimplifyOptions)`: Runs the simplification optimization with the given options.
		 * - `dedupOptimization(options?: DedupOptions)`: Runs the deduplication optimization with the given options.
		 * - `quantizeOptimization(options?: QuantizeOptions)`: Runs the quantization optimization with the given options.
		 * - `texturesCompressionOptimization(options?: TextureCompressionOptions)`: Runs the texture compression optimization with the given options.
		 * - `getSize()`: Returns the size of the optimized model.
		 * - `reset()`: Resets the optimizer.
		 * - `report`: The report state of the optimizer.
		 * - `error`: The error state of the optimizer.
		 * - `loading`: The loading state of the optimizer.
		 */
		optimize: optimizerIntegration
	}
}

type OptimizerReturnType = ReturnType<typeof useOptimizeModel>
type Optimizations = OptimizerReturnType['optimizations']
type OptimizerIntegrationReturn = Partial<OptimizerReturnType> & {
	/**
	 * Applies the specified optimization function with optional parameters.
	 *
	 * @param optimizationFunction - (Optional) The optimization function to run before updating the model with the optimizer model document.
	 * @param options - Optional parameters for the optimization function.
	 */
	applyOptimization: <TOptions>(
		optimizationFunction?: ((options?: TOptions) => Promise<void>) | undefined,
		options?: TOptions
	) => Promise<void>
	optimizations: Optimizations
}

/**
 * Hook to integrate the optimizer into the model loading process.
 *
 * @param optimizer - The optimizer instance.
 * @param dispatch - The dispatch function from useReducer.
 * @param file - The current model file.
 * @returns An object containing optimization functions and optimizer states.
 */
function useOptimizerIntegration(
	optimizer: ReturnType<typeof useOptimizeModel> | undefined,
	dispatch: React.Dispatch<Action>,
	file: ModelFile | null
) {
	const dispatchNewModel = useCallback(
		(modelBuffer: Uint8Array) => {
			const gltfLoader = createGltfLoader()

			gltfLoader.parse(
				modelBuffer.buffer as ArrayBuffer,
				'',
				(gltf) => {
					dispatch({
						type: 'set-file',
						payload: {
							model: gltf.scene,
							type: ModelFileTypes.glb,
							name: file?.name || 'optimized.glb'
						}
					})
				},
				(error) => {
					console.error('Error loading new model:', error)
				}
			)
		},
		[dispatch, file]
	)

	const applyOptimization = useCallback(
		async <TOptions>(
			optimizationFunction?:
				| ((options?: TOptions) => Promise<void>)
				| undefined,
			options?: TOptions
		) => {
			if (!optimizer) {
				console.warn('Optimizer is not available')
				return
			}

			try {
				// Apply the optimization with optional parameters
				if (optimizationFunction) await optimizationFunction(options)

				const optimizedModel = await optimizer.getModel()

				if (optimizedModel) {
					dispatchNewModel(optimizedModel)
				}
			} catch (error) {
				console.error('Optimization failed:', error)
				// Optionally dispatch an error action here
			}
		},
		[optimizer, dispatchNewModel]
	)

	return {
		applyOptimization: applyOptimization,
		optimizations: optimizer?.optimizations,
		reset: optimizer?.reset,
		report: optimizer?.optimizations.report,
		error: optimizer?.error,
		loading: optimizer?.loading
	} as OptimizerIntegrationReturn
}
export default useLoadModel
