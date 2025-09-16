'use client'

/* vectreal-core | vctrl/hooks
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

import {
	type DedupOptions,
	ModelOptimizer,
	type NormalsOptions,
	type OptimizationProgress,
	type QuantizeOptions,
	type SimplifyOptions,
	type TextureCompressOptions
} from '@vctrl/core'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { Object3D } from 'three'

import { initialState, reducer } from './state'
import { useCalcOptimizationInfo } from './use-calc-optimization-info'

/**
 * Custom React hook for optimizing Three.js models using the core ModelOptimizer.
 *
 * This hook provides a React-friendly interface to the server-side optimization
 * capabilities while gracefully handling browser limitations (like Sharp for textures).
 *
 * @returns An object containing functions to interact with the model optimizer.
 */
const useOptimizeModel = () => {
	// Use useReducer to manage complex state transitions.
	const [state, dispatch] = useReducer(reducer, initialState)
	const { report, error, loading } = state
	const { info, reset: resetInfo } = useCalcOptimizationInfo(state)

	// Initialize the ModelOptimizer with progress tracking
	const optimizerRef = useRef<ModelOptimizer>(new ModelOptimizer())

	useEffect(() => {
		const optimizer = optimizerRef.current

		// Set up progress tracking
		optimizer.onProgress((progress: OptimizationProgress) => {
			// Could dispatch progress updates to state if needed
			console.log(`${progress.operation}: ${progress.progress}%`)
		})

		return () => {
			optimizer.reset()
		}
	}, [])

	const load = useCallback(async (model: Object3D): Promise<void> => {
		dispatch({ type: 'LOAD_START' })

		try {
			const optimizer = optimizerRef.current
			await optimizer.loadFromThreeJS(model)

			// Get the report from the optimizer
			const optimizationReport = await optimizer.getReport()

			dispatch({
				type: 'LOAD_SUCCESS',
				payload: {
					model: await optimizer.export(), // Store as Uint8Array for now
					report: optimizationReport
				}
			})
		} catch (err) {
			dispatch({ type: 'LOAD_ERROR', payload: err as Error })
			console.error('Error loading model:', err)
		}
	}, [])

	const simplifyOptimization = useCallback(
		async (options?: SimplifyOptions): Promise<void> => {
			if (!optimizerRef.current.hasModel()) return

			try {
				await optimizerRef.current.simplify(options)
				const report = await optimizerRef.current.getReport()

				dispatch({
					type: 'LOAD_SUCCESS',
					payload: {
						model: await optimizerRef.current.export(),
						report
					}
				})
			} catch (err) {
				console.error('Simplification failed:', err)
			}
		},
		[]
	)

	const dedupOptimization = useCallback(
		async (options?: DedupOptions): Promise<void> => {
			if (!optimizerRef.current.hasModel()) return

			try {
				await optimizerRef.current.deduplicate(options)
				const report = await optimizerRef.current.getReport()

				dispatch({
					type: 'LOAD_SUCCESS',
					payload: {
						model: await optimizerRef.current.export(),
						report
					}
				})
			} catch (err) {
				console.error('Deduplication failed:', err)
			}
		},
		[]
	)

	const quantizeOptimization = useCallback(
		async (options?: QuantizeOptions): Promise<void> => {
			if (!optimizerRef.current.hasModel()) return

			try {
				await optimizerRef.current.quantize(options)
				const report = await optimizerRef.current.getReport()

				dispatch({
					type: 'LOAD_SUCCESS',
					payload: {
						model: await optimizerRef.current.export(),
						report
					}
				})
			} catch (err) {
				console.error('Quantization failed:', err)
			}
		},
		[]
	)

	const normalsOptimization = useCallback(
		async (options?: NormalsOptions): Promise<void> => {
			if (!optimizerRef.current.hasModel()) return

			try {
				await optimizerRef.current.optimizeNormals(options)
				const report = await optimizerRef.current.getReport()

				dispatch({
					type: 'LOAD_SUCCESS',
					payload: {
						model: await optimizerRef.current.export(),
						report
					}
				})
			} catch (err) {
				console.error('Normals optimization failed:', err)
			}
		},
		[]
	)

	const texturesOptimization = useCallback(
		async (options?: TextureCompressOptions): Promise<void> => {
			if (!optimizerRef.current.hasModel()) return

			// Check if we're in a browser environment
			if (typeof window !== 'undefined') {
				console.warn(
					'Texture compression requires a Node.js server environment. This operation will be skipped in the browser.'
				)
				return
			}

			try {
				await optimizerRef.current.compressTextures(options)
				const report = await optimizerRef.current.getReport()

				dispatch({
					type: 'LOAD_SUCCESS',
					payload: {
						model: await optimizerRef.current.export(),
						report
					}
				})
			} catch (err) {
				console.error('Texture compression failed:', err)
			}
		},
		[]
	)

	const getModel = useCallback(async (): Promise<Uint8Array | null> => {
		if (!optimizerRef.current.hasModel()) return null

		try {
			return await optimizerRef.current.export()
		} catch (err) {
			console.error('Error getting model binary:', err)
			return null
		}
	}, [])

	const reset = useCallback((): void => {
		optimizerRef.current.reset()
		dispatch({ type: 'RESET' })
		resetInfo()
	}, [resetInfo])

	return {
		/**
		 * Loads a Three.js Object3D model into the optimizer.
		 *
		 * @param model - The Three.js Object3D model to load.
		 * @returns A promise that resolves when the model is loaded.
		 */
		load,
		/**
		 * Retrieves the current model document as a binary ArrayBuffer.
		 *
		 * @returns A promise that resolves with the model's ArrayBuffer or null if no model is loaded.
		 */
		getModel,
		/**
		 * Resets the current model and report.
		 */
		reset,
		error,
		loading,
		optimizations: {
			report,
			info,
			/**
			 * Simplifies the current model document using MeshoptSimplifier.
			 *
			 * @param options - Optional parameters to control simplification.
			 * @returns A promise that resolves when the model has been simplified.
			 */
			simplifyOptimization,
			/**
			 * De-duplicates the current model document.
			 *
			 * @returns A promise that resolves when the model has been deduplicated.
			 */
			dedupOptimization,
			/**
			 * Quantizes the current model document.
			 *
			 * @param options - Optional parameters to control quantization.
			 * @returns A promise that resolves when the model has been quantized.
			 */
			quantizeOptimization,
			/**
			 * Optimizes the normals of a model by applying the specified transformations.
			 *
			 * @param options - Optional parameters for the normals transformation function.
			 * @returns A promise that resolves when the optimization is complete.
			 */
			normalsOptimization,
			/**
			 * Compresses the relevant texture data in the document using texture compression.
			 * Note: Only works in Node.js server environments.
			 *
			 * @param options - Optional parameters to control texture compression.
			 * @returns A promise that resolves when the model has been compressed.
			 */
			texturesOptimization
		}
	}
}

export default useOptimizeModel
