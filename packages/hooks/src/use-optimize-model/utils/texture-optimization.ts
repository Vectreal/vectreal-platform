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

import { JSONDocument } from '@gltf-transform/core'
import { type ModelOptimizer, type TextureCompressOptions } from '@vctrl/core'

import {
	createDefaultServerOptions,
	handleServerResponseError,
	performTextureOptimizationRequest,
	prepareTextureOptimizationFormData
} from './server-communication'
import { validateServerResponse } from './validation'

/**
 * Performs server-side texture optimization.
 */
export const performServerSideTextureOptimization = async (
	optimizer: ModelOptimizer,
	options: TextureCompressOptions
): Promise<void> => {
	const serverOptions = createDefaultServerOptions(options.serverOptions)
	const modelBuffer = await optimizer.export()
	const formData = await prepareTextureOptimizationFormData(
		modelBuffer,
		options
	)

	try {
		const response = await performTextureOptimizationRequest(
			serverOptions,
			formData
		)

		if (!response.ok) {
			await handleServerResponseError(response)
		}

		await validateServerResponse(response)

		// Extract applied optimizations from server response headers
		const optimizationReportHeader = response.headers.get(
			'X-Optimization-Report'
		)
		let serverAppliedOptimizations: string[] = []

		if (optimizationReportHeader) {
			try {
				const reportData = JSON.parse(optimizationReportHeader)
				// The server sends textureOptimizations, but we want to track as 'texture compression'
				if (
					reportData.textureOptimizations &&
					reportData.textureOptimizations.length > 0
				) {
					serverAppliedOptimizations = ['texture compression']
				}
			} catch (err) {
				console.warn('Failed to parse optimization report from server:', err)
			}
		}

		const jsonResponse: JSONDocument = await response.json()
		console.log('Received optimized model from server:', jsonResponse)

		// Preserve existing applied optimizations before loading new buffer
		const currentAppliedOptimizations = optimizer.getAppliedOptimizations()

		// The server returns a JSONDocument with resources as object properties
		// We need to convert the resources to Uint8Arrays for loadFromJSON
		const processedResources: Record<string, Uint8Array> = {}

		if (jsonResponse.resources) {
			for (const [key, value] of Object.entries(jsonResponse.resources)) {
				// Convert ArrayBuffer or regular arrays to Uint8Array
				if (value instanceof ArrayBuffer) {
					processedResources[key] = new Uint8Array(value)
				} else if (Array.isArray(value)) {
					processedResources[key] = new Uint8Array(value)
				} else if (value instanceof Uint8Array) {
					processedResources[key] = value
				} else {
					// If it's already an object with array-like data, convert it
					processedResources[key] = new Uint8Array(
						Object.values(value as object)
					)
				}
			}
		}

		const processedJsonResponse: JSONDocument = {
			json: jsonResponse.json,
			resources: processedResources
		}

		await optimizer.loadFromJSON(processedJsonResponse)

		// Restore and merge applied optimizations
		const mergedOptimizations = [
			...currentAppliedOptimizations,
			...serverAppliedOptimizations
		]
		optimizer.setAppliedOptimizations(mergedOptimizations)
	} catch (err) {
		console.error('Server-side texture compression failed:', err)
		throw new Error(
			`Server-side texture compression failed: ${err}. Client-side texture compression is not supported in browser environments.`
		)
	}
}

/**
 * Handles client-side texture optimization (throws error as not supported in browser).
 */
export const performClientSideTextureOptimization = (): never => {
	console.warn(
		'Client-side texture compression is not supported in browser environments. ' +
			'Please enable server-side compression by setting serverOptions.enabled = true.'
	)

	// Instead of trying to compress textures, we could implement basic optimizations
	// that don't require Sharp, but for now we'll throw an error
	throw new Error(
		'Texture compression requires server-side processing. Enable serverOptions.enabled = true in your options.'
	)
}

/**
 * Determines if server-side optimization should be used.
 */
export const shouldUseServerOptimization = (
	options?: TextureCompressOptions
): boolean => {
	return options?.serverOptions?.enabled ?? false
}

/**
 * Main texture optimization function that orchestrates the process.
 */
export const optimizeTextures = async (
	optimizer: ModelOptimizer,
	options?: TextureCompressOptions
): Promise<void> => {
	if (!optimizer.hasModel()) {
		return
	}

	const useServer = shouldUseServerOptimization(options)

	if (useServer && options) {
		await performServerSideTextureOptimization(optimizer, options)
	} else {
		performClientSideTextureOptimization()
	}
}
