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
	KHRMaterialsIOR,
	KHRMaterialsSpecular,
	KHRMaterialsTransmission,
	KHRMaterialsVolume,
	KHRMeshQuantization
} from '@gltf-transform/extensions'
import {
	dedup,
	inspect,
	normals,
	quantize,
	simplify,
	textureCompress,
	weld
} from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { useCallback, useReducer, useRef } from 'react'
import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'

import { initialState, reducer } from './state'
import { ModelSize } from './types'

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
	const { modelDoc, modelReport, error, loading } = state

	// Initialize the GLTFExporter and WebIO with required extensions.
	const exporterRef = useRef<GLTFExporter>(new GLTFExporter())
	const ioRef = useRef<WebIO>(
		new WebIO().registerExtensions([
			KHRMeshQuantization,
			KHRMaterialsVolume,
			KHRMaterialsTransmission,
			KHRMaterialsSpecular,
			KHRMaterialsIOR,
			KHRDracoMeshCompression
		])
	)

	/**
	 * Loads a Three.js Object3D model into the optimizer.
	 *
	 * @param model - The Three.js Object3D model to load.
	 * @returns A promise that resolves when the model is loaded.
	 */
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
				payload: { modelDoc: doc, modelReport: report }
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
			if (!modelDoc) return

			try {
				await modelDoc.transform(...transforms)

				// Update the model report after transformations.
				const report = inspect(modelDoc)
				dispatch({
					type: 'LOAD_SUCCESS',
					payload: { modelDoc, modelReport: report }
				})
			} catch (err) {
				console.error('Error applying transforms:', err)
			}
		},
		[modelDoc]
	)

	/**
	 * Simplifies the current model document using MeshoptSimplifier.
	 *
	 * @param options - Optional parameters to control simplification.
	 * @param options.ratio - The simplification ratio - default = 0.5.
	 * @param options.error - The simplification error value - default = 0.001.
	 * @returns A promise that resolves when the model has been simplified.
	 */
	const simplifyOptimization = useCallback(
		async (options?: { ratio?: number; error?: number }): Promise<void> => {
			const { ratio = 0.5, error: simplifierError = 0.001 } = options || {}

			await applyTransforms([
				weld(),
				simplify({
					simplifier: MeshoptSimplifier,
					ratio,
					error: simplifierError
				})
			])
		},
		[applyTransforms]
	)

	/**
	 * De-duplicates the current model document.
	 *
	 * @returns A promise that resolves when the model has been deduplicated.
	 */
	const dedupOptimization = useCallback(
		async (options?: Parameters<typeof dedup>[0]): Promise<void> => {
			await applyTransforms([dedup(options)])
		},
		[applyTransforms]
	)

	/**
	 * Quantizes the current model document.
	 *
	 * @param options - Optional parameters to control quantization.
	 * @returns A promise that resolves when the model has been quantized.
	 */
	const quantizeOptimization = useCallback(
		async (options?: Parameters<typeof quantize>[0]): Promise<void> => {
			await applyTransforms([quantize(options)])
		},
		[applyTransforms]
	)

	/**
	 * Optimizes the normals of a model by applying the specified transformations.
	 *
	 * @param options - Optional parameters for the normals transformation function.
	 * @returns A promise that resolves when the optimization is complete.
	 */
	const normalsOptimization = useCallback(
		async (options?: Parameters<typeof normals>[0]): Promise<void> => {
			await applyTransforms([normals(options)])
		},
		[applyTransforms]
	)

	/**
	 * Compresses the relevant texture data in the document using texture compression.
	 *
	 * @param options - Optional parameters to control texture compression.
	 * @returns A promise that resolves when the model has been compressed.
	 */
	const texturesOptimization = useCallback(
		async (options?: Parameters<typeof textureCompress>[0]): Promise<void> => {
			options && (await applyTransforms([textureCompress(options)]))
		},
		[applyTransforms]
	)

	/**
	 * Retrieves the current model document as a binary ArrayBuffer.
	 *
	 * @returns A promise that resolves with the model's ArrayBuffer or null if no model is loaded.
	 */
	const getModel = useCallback(async (): Promise<Uint8Array | null> => {
		if (!modelDoc) return null

		try {
			return await ioRef.current.writeBinary(modelDoc)
		} catch (err) {
			console.error('Error getting model binary:', err)
			return null
		}
	}, [modelDoc])

	/**
	 * Calculates and returns the size details of the current model document.
	 *
	 * @returns An object containing the file size in bytes and a human-readable string, or null if no report is available.
	 */
	const getSize = useCallback((): ModelSize | null => {
		if (!modelReport) return null

		const sumSize = (properties: { size: number }[]) =>
			properties.reduce((total, prop) => total + prop.size, 0)

		const meshesSize = sumSize(modelReport.meshes.properties)
		const texturesSize = sumSize(modelReport.textures.properties)

		const fileSize = meshesSize + texturesSize
		const displayFileSize = `${(fileSize / (1024 * 1024)).toFixed(2)} MB`

		return { fileSize, displayFileSize }
	}, [modelReport])

	/**
	 * Resets the current model and report.
	 */
	const reset = useCallback((): void => {
		dispatch({ type: 'RESET' })
	}, [])

	return {
		load,
		getModel,
		getSize,
		report: modelReport,
		simplifyOptimization,
		dedupOptimization,
		quantizeOptimization,
		normalsOptimization,
		texturesOptimization,
		reset,
		error,
		loading
	}
}

export default useOptimizeModel
