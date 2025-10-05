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
import { optimizeTextures } from './utils'

/**
 * Custom React hook for optimizing 3D models using the ModelOptimizer from @vctrl/core.
 *
 * This hook provides a React-friendly interface to advanced model optimization capabilities,
 * including mesh simplification, deduplication, quantization, normal optimization, and texture compression.
 * It manages the optimization state and provides callbacks for each optimization operation.
 *
 * **Features:**
 * - Mesh simplification using MeshoptSimplifier
 * - Geometry deduplication to remove redundant data
 * - Vertex attribute quantization to reduce file size
 * - Normal vector optimization
 * - Texture compression (server-side only)
 * - Progress tracking and error handling
 * - Optimization reports with before/after metrics
 *
 * @example
 * const optimizer = useOptimizeModel()
 *
 * // Load a model
 * await optimizer.load(threeJsScene)
 *
 * // Apply optimizations
 * await optimizer.simplifyOptimization({ ratio: 0.5 })
 * await optimizer.quantizeOptimization({ bits: 12 })
 *
 * // Get optimized model
 * const optimizedBinary = await optimizer.getModel()
 *
 * @returns Object containing optimization methods, state, and report data
 */
const useOptimizeModel = () => {
	// Manage state with useReducer for complex state transitions
	const [state, dispatch] = useReducer(reducer, initialState)
	const { report, error, loading } = state

	// Calculate optimization statistics (file size reduction, etc.)
	const { info, reset: resetInfo } = useCalcOptimizationInfo(state)

	// Store the ModelOptimizer instance in a ref to persist across renders
	const optimizerRef = useRef<ModelOptimizer>(new ModelOptimizer())

	/**
	 * Initialize the optimizer and set up progress tracking.
	 * Cleanup function resets the optimizer when component unmounts.
	 */
	useEffect(() => {
		const optimizer = optimizerRef.current

		// Set up progress callback for optimization operations
		// Can be extended to dispatch progress updates to state if needed
		optimizer.onProgress((progress: OptimizationProgress) => {
			// Future: dispatch({ type: 'UPDATE_PROGRESS', payload: progress })
		})

		// Cleanup: reset optimizer when component unmounts
		return () => {
			optimizer.reset()
		}
	}, [])

	/**
	 * Loads a Three.js Object3D model into the optimizer for processing.
	 * Converts the Three.js scene to glTF format and generates an initial optimization report.
	 *
	 * @param model - The Three.js Object3D scene to optimize
	 * @returns Promise that resolves when the model is loaded and ready for optimization
	 */
	const load = useCallback(async (model: Object3D): Promise<void> => {
		dispatch({ type: 'LOAD_START' })

		try {
			const optimizer = optimizerRef.current

			// Convert Three.js scene to glTF document for optimization
			await optimizer.loadFromThreeJS(model)
		} catch (err) {
			dispatch({ type: 'LOAD_ERROR', payload: err as Error })
			console.error('Error loading model:', err)
		}
	}, [])

	/**
	 * Simplifies the loaded model by reducing polygon count using MeshoptSimplifier.
	 * This reduces file size and improves rendering performance while maintaining visual quality.
	 *
	 * @param options - Configuration options for simplification
	 * @param options.ratio - Target ratio of triangles to keep (0.0-1.0). Default: 0.5
	 * @param options.error - Maximum allowed error threshold. Default: 0.01
	 * @returns Promise that resolves when simplification is complete
	 */
	const simplifyOptimization = useCallback(
		async (options?: SimplifyOptions): Promise<void> => {
			// Guard: ensure a model is loaded before attempting optimization
			if (!optimizerRef.current.hasModel()) return

			try {
				// Apply mesh simplification
				await optimizerRef.current.simplify(options)

				// Generate updated report with new metrics
				const report = await optimizerRef.current.getReport()

				// Update state with optimized model
				dispatch({
					type: 'LOAD_SUCCESS',
					payload: {
						report
					}
				})
			} catch (err) {
				console.error('Simplification failed:', err)
			}
		},
		[]
	)

	/**
	 * De-duplicates geometry and material data in the model.
	 * Removes redundant vertices, primitives, and other duplicate data to reduce file size.
	 *
	 * @param options - Configuration options for deduplication
	 * @returns Promise that resolves when deduplication is complete
	 */
	const dedupOptimization = useCallback(
		async (options?: DedupOptions): Promise<void> => {
			// Guard: ensure a model is loaded before attempting optimization
			if (!optimizerRef.current.hasModel()) return

			try {
				// Remove duplicate geometry and material data
				await optimizerRef.current.deduplicate(options)

				// Generate updated report
				const report = await optimizerRef.current.getReport()

				// Update state with optimized model
				dispatch({
					type: 'LOAD_SUCCESS',
					payload: { report }
				})
			} catch (err) {
				console.error('Deduplication failed:', err)
			}
		},
		[]
	)

	/**
	 * Quantizes vertex attributes (positions, normals, UVs) to use fewer bits.
	 * Reduces file size with minimal visual quality loss by storing data with lower precision.
	 *
	 * @param options - Configuration options for quantization
	 * @param options.bits - Number of bits to use for quantization. Default: 14
	 * @returns Promise that resolves when quantization is complete
	 */
	const quantizeOptimization = useCallback(
		async (options?: QuantizeOptions): Promise<void> => {
			// Guard: ensure a model is loaded before attempting optimization
			if (!optimizerRef.current.hasModel()) return

			try {
				// Apply vertex attribute quantization
				await optimizerRef.current.quantize(options)

				// Generate updated report
				const report = await optimizerRef.current.getReport()

				// Update state with optimized model
				dispatch({
					type: 'LOAD_SUCCESS',
					payload: { report }
				})
			} catch (err) {
				console.error('Quantization failed:', err)
			}
		},
		[]
	)

	/**
	 * Optimizes normal vectors in the model.
	 * Can remove, generate, or clean up normal data to improve rendering quality or reduce file size.
	 *
	 * @param options - Configuration options for normal optimization
	 * @returns Promise that resolves when normal optimization is complete
	 */
	const normalsOptimization = useCallback(
		async (options?: NormalsOptions): Promise<void> => {
			// Guard: ensure a model is loaded before attempting optimization
			if (!optimizerRef.current.hasModel()) return

			try {
				// Apply normal vector optimizations
				await optimizerRef.current.optimizeNormals(options)

				// Generate updated report
				const report = await optimizerRef.current.getReport()

				// Update state with optimized model
				dispatch({
					type: 'LOAD_SUCCESS',
					payload: { report }
				})
			} catch (err) {
				console.error('Normals optimization failed:', err)
			}
		},
		[]
	)

	/**
	 * Compresses textures in the model using advanced compression formats.
	 * Significantly reduces file size while maintaining visual quality.
	 *
	 * **Note:** This optimization requires server-side processing (Sharp library)
	 * and may not work in browser-only environments.
	 *
	 * @param options - Configuration options for texture compression
	 * @param options.format - Target compression format (e.g., 'webp', 'ktx2')
	 * @param options.quality - Compression quality (0-100)
	 * @returns Promise that resolves when texture compression is complete
	 * @throws Error if Sharp is not available or compression fails
	 */
	const texturesOptimization = useCallback(
		async (options?: TextureCompressOptions): Promise<void> => {
			try {
				// Apply texture compression using utility function
				// This handles Sharp availability checks and fallbacks
				await optimizeTextures(optimizerRef.current, options)

				// Generate updated report
				const report = await optimizerRef.current.getReport()

				// Update state with optimized model
				dispatch({
					type: 'LOAD_SUCCESS',
					payload: { report }
				})
			} catch (err) {
				console.error('Texture optimization failed:', err)
				// Re-throw to allow caller to handle compression failures
				throw err
			}
		},
		[]
	)

	/**
	 * Exports the current optimized model as a binary Uint8Array.
	 * The model is exported in glTF binary (.glb) format.
	 *
	 * @returns Promise that resolves with the model binary, or null if no model is loaded
	 */
	const getModel = useCallback(async (): Promise<Uint8Array | null> => {
		// Guard: return null if no model is currently loaded
		if (!optimizerRef.current.hasModel()) return null

		try {
			// Export model as Uint8Array binary data
			return await optimizerRef.current.export()
		} catch (err) {
			console.error('Error getting model binary:', err)
			return null
		}
	}, [])

	/**
	 * Resets the optimizer to its initial state.
	 * Clears the loaded model, all optimization data, reports, and calculated info.
	 */
	const reset = useCallback((): void => {
		// Reset the core optimizer instance
		optimizerRef.current.reset()

		// Reset React state to initial values
		dispatch({ type: 'RESET' })

		// Reset calculated optimization info
		resetInfo()
	}, [resetInfo])

	return {
		/**
		 * Loads a Three.js Object3D model into the optimizer.
		 * Converts the scene to glTF format and generates an initial optimization report.
		 *
		 * @param model - The Three.js Object3D model to load
		 * @returns Promise that resolves when the model is loaded
		 */
		load,

		/**
		 * Retrieves the current model as a binary Uint8Array in glTF (.glb) format.
		 *
		 * @returns Promise that resolves with the model binary or null if no model is loaded
		 */
		getModel,

		/**
		 * Exposes the underlying ModelOptimizer document instance for advanced use cases.
		 */
		_getDocument: () => optimizerRef.current.document, // Expose document for advanced use cases --- IGNORE ---

		/**
		 * Resets the optimizer, clearing all model data, reports, and state.
		 */
		reset,

		/**
		 * Error object if any optimization operation failed, otherwise null.
		 */
		error,

		/**
		 * Boolean indicating if an optimization operation is currently in progress.
		 */
		loading,

		/**
		 * Detailed optimization report containing metrics about the model
		 * (vertex count, triangle count, file size, etc.) before and after optimizations.
		 */
		report, // Keep report in state for direct access --- IGNORE ---

		/**
		 * Calculated optimization information including file size reduction percentages
		 * and comparative metrics.
		 */
		info,

		/**
		 * Simplifies the model by reducing polygon count using MeshoptSimplifier.
		 * Maintains visual quality while improving performance.
		 *
		 * @param options - Simplification options (ratio, error threshold)
		 * @returns Promise that resolves when simplification is complete
		 */
		simplifyOptimization,

		/**
		 * Removes duplicate vertices, primitives, and other redundant data.
		 * Reduces file size without affecting visual appearance.
		 *
		 * @param options - Deduplication options
		 * @returns Promise that resolves when deduplication is complete
		 */
		dedupOptimization,

		/**
		 * Quantizes vertex attributes to use fewer bits per value.
		 * Reduces file size with minimal visual quality loss.
		 *
		 * @param options - Quantization options (bit depth)
		 * @returns Promise that resolves when quantization is complete
		 */
		quantizeOptimization,

		/**
		 * Optimizes normal vectors by removing, generating, or cleaning up normal data.
		 *
		 * @param options - Normal optimization options
		 * @returns Promise that resolves when optimization is complete
		 */
		normalsOptimization,

		/**
		 * Compresses textures using advanced formats (requires server-side processing).
		 * Note: Only works in Node.js environments with Sharp library available.
		 *
		 * @param options - Texture compression options (format, quality)
		 * @returns Promise that resolves when compression is complete
		 * @throws Error if Sharp is not available
		 */
		texturesOptimization
	}
}

export default useOptimizeModel
