/* vectreal-platform | API Route
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

import { ModelProcessingService } from '@vctrl/core'
import { data } from 'react-router'

/**
 * Server-side model optimization API endpoint.
 *
 * This endpoint demonstrates how to use the @vctrl/core package
 * for server-side 3D model processing.
 *
 * Example usage:
 * POST /api/optimize-model
 * Content-Type: multipart/form-data
 *
 * Body:
 * - file: GLB/GLTF model file
 * - options: JSON string with optimization options
 */
export async function action({ request }: { request: Request }) {
	try {
		// Parse multipart form data
		const formData = await request.formData()
		const file = formData.get('file') as File
		const optionsStr = formData.get('options') as string

		if (!file) {
			return data({ error: 'No file provided' }, { status: 400 })
		}

		// Parse optimization options
		const options = optionsStr ? JSON.parse(optionsStr) : {}

		// Convert file to buffer
		const buffer = new Uint8Array(await file.arrayBuffer())

		// Initialize the model processing service
		const service = new ModelProcessingService()

		// Set up progress tracking (optional)
		service.onProgress((progress) => {
			console.log(
				`${progress.stage}: ${progress.operation} - ${progress.progress}%`
			)
		})

		// Process the model
		const result = await service.processModel(
			{ buffer, fileName: file.name },
			{
				simplify:
					options.simplify !== false ? { ratio: options.ratio || 0.5 } : false,
				dedup: options.dedup !== false,
				quantize: options.quantize !== false,
				normals: options.normals !== false,
				textures: options.textures
					? {
							quality: options.textureQuality || 80,
							targetFormat: options.textureFormat || 'webp'
						}
					: false
			},
			{ format: options.format || 'glb' }
		)

		// Get optimization report
		const report = await service.getOptimizationReport()

		// Return the optimized model as a downloadable blob
		const headers = new Headers({
			'Content-Type':
				result.format === 'glb' ? 'model/gltf-binary' : 'application/json',
			'Content-Disposition': `attachment; filename="optimized_${file.name}"`,
			'X-Optimization-Report': JSON.stringify(report)
		})

		return new Response(result.data as Uint8Array, { headers })
	} catch (error) {
		console.error('Model optimization failed:', error)
		return data(
			{
				error: 'Model optimization failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		)
	}
}

// Handle GET requests with information about the endpoint
export function loader() {
	return data({
		endpoint: '/api/optimize-model',
		method: 'POST',
		description: 'Server-side 3D model optimization using @vctrl/core',
		parameters: {
			file: 'Model file (GLB/GLTF)',
			options: 'JSON string with optimization settings'
		},
		example: {
			simplify: true,
			ratio: 0.5,
			dedup: true,
			quantize: true,
			normals: true,
			textures: {
				quality: 80,
				targetFormat: 'webp'
			},
			format: 'glb'
		}
	})
}
