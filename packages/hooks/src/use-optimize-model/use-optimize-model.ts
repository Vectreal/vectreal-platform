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

import { Transform, WebIO } from '@gltf-transform/core'
import {
	KHRDracoMeshCompression,
	KHRLightsPunctual,
	KHRMaterialsAnisotropy,
	KHRMaterialsClearcoat,
	KHRMaterialsDiffuseTransmission,
	KHRMaterialsDispersion,
	KHRMaterialsEmissiveStrength,
	KHRMaterialsIOR,
	KHRMaterialsIridescence,
	KHRMaterialsPBRSpecularGlossiness,
	KHRMaterialsSheen,
	KHRMaterialsSpecular,
	KHRMaterialsTransmission,
	KHRMaterialsUnlit,
	KHRMaterialsVolume,
	KHRMeshQuantization,
	KHRTextureTransform
} from '@gltf-transform/extensions'
import {
	dedup,
	DedupOptions,
	inspect,
	normals,
	NormalsOptions,
	quantize,
	QuantizeOptions,
	simplify,
	SimplifyOptions,
	textureCompress,
	TextureCompressOptions,
	weld
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { useCallback, useReducer, useRef } from 'react'
import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'

import { initialState, reducer } from './state'
import { useCalcOptimizationInfo } from './use-calc-optimization-info'

/**
 * Custom React hook for optimizing Three.js models using glTF-Transform.
 *
 * This hook provides functions to load, optimize, and retrieve Three.js models.
 * Optimizations include deduplication, quantization, and simplification of model meshes and textures.
 *
 * @returns An object containing functions to interact with the model optimizer.
 */
const useOptimizeModel = () => {
	// Use useReducer to manage complex state transitions.
	const [state, dispatch] = useReducer(reducer, initialState)
	const { model, report, error, loading } = state
	const { info, reset: resetInfo } = useCalcOptimizationInfo(state)

	// Initialize the GLTFExporter and WebIO with required extensions.
	const exporterRef = useRef<GLTFExporter>(new GLTFExporter())
	const ioRef = useRef<WebIO>(
		new WebIO().registerExtensions([
			KHRDracoMeshCompression,
			KHRLightsPunctual,
			KHRMaterialsAnisotropy,
			KHRMaterialsClearcoat,
			KHRMaterialsDiffuseTransmission,
			KHRMaterialsDispersion,
			KHRMaterialsEmissiveStrength,
			KHRMaterialsIOR,
			KHRMaterialsIridescence,
			KHRMaterialsPBRSpecularGlossiness,
			KHRMaterialsSheen,
			KHRMaterialsSpecular,
			KHRMaterialsTransmission,
			KHRMaterialsUnlit,
			KHRMaterialsVolume,
			KHRMeshQuantization,
			KHRTextureTransform
		])
	)

	const load = useCallback(async (model: Object3D): Promise<void> => {
		dispatch({ type: 'LOAD_START' })

		try {
			const parseOptions = { binary: true }
			const binary = await exporterRef.current.parseAsync(model, parseOptions)
			const modelBuffer = new Uint8Array(binary as ArrayBuffer)
			const doc = await ioRef.current.readBinary(modelBuffer)

			const report = inspect(doc)

			dispatch({
				type: 'LOAD_SUCCESS',
				payload: { model: doc, report: report }
			})
		} catch (err) {
			dispatch({ type: 'LOAD_ERROR', payload: err as Error })
			console.error('Error loading model:', err)
		}
	}, [])

	/**
	 * Helper function to apply transformations to the model document and update the state.
	 *
	 * @param transforms - Array of transforms to apply.
	 */
	const applyTransforms = useCallback(
		async (transforms: Transform[]): Promise<void> => {
			if (!model) return

			try {
				await model.transform(...transforms)

				// Update the model report after transformations.
				const report = inspect(model)
				dispatch({
					type: 'LOAD_SUCCESS',
					payload: { model: model, report: report }
				})
			} catch (err) {
				console.error('Error applying transforms:', err)
			}
		},
		[model]
	)

	const simplifyOptimization = useCallback(
		async (options?: Omit<SimplifyOptions, 'simplifier'>): Promise<void> => {
			const { ratio = 0.5, error: simplifierError = 0.001 } = options || {}

			await applyTransforms([
				weld(),
				simplify({
					ratio,
					simplifier: MeshoptSimplifier,
					error: simplifierError
				})
			])
		},
		[applyTransforms]
	)

	const dedupOptimization = useCallback(
		async (options?: DedupOptions): Promise<void> => {
			await applyTransforms([dedup(options)])
		},
		[applyTransforms]
	)

	const quantizeOptimization = useCallback(
		async (options?: QuantizeOptions): Promise<void> => {
			await applyTransforms([quantize(options)])
		},
		[applyTransforms]
	)

	const normalsOptimization = useCallback(
		async (options?: NormalsOptions): Promise<void> => {
			await applyTransforms([normals(options)])
		},
		[applyTransforms]
	)

	const texturesOptimization = useCallback(
		async (options?: TextureCompressOptions): Promise<void> => {
			options && (await applyTransforms([textureCompress(options)]))
		},
		[applyTransforms]
	)

	const getModel = useCallback(async (): Promise<Uint8Array | null> => {
		if (!model) return null

		try {
			return await ioRef.current.writeBinary(model)
		} catch (err) {
			console.error('Error getting model binary:', err)
			return null
		}
	}, [model])

	const reset = useCallback((): void => {
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
			 * @param options.ratio - The simplification ratio - default = 0.5.
			 * @param options.error - The simplification error value - default = 0.001.
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
			 *
			 * @param options - Optional parameters to control texture compression.
			 * @returns A promise that resolves when the model has been compressed.
			 */
			texturesOptimization
		}
	}
}

export default useOptimizeModel
