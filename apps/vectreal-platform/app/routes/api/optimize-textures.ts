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

import { ModelOptimizer, TextureCompressOptions } from '@vctrl/core'
import { data } from 'react-router'

import { Route } from './+types/optimize-textures'

/**
 * Server-side texture optimization API endpoint.
 *
 * This endpoint focuses specifically on texture compression and optimization
 * using Sharp for high-quality image processing in Node.js environments.
 *
 * Example usage:
 * POST /api/optimize-textures
 * Content-Type: multipart/form-data
 *
 * Body:
 * - model: GLB model file (as sent by useOptimizeModel hook)
 * - options: JSON string with TextureCompressOptions
 */
export async function action({ request }: Route.ActionArgs) {
	try {
		// Parse multipart form data
		const formData = await request.formData()
		const modelFile = formData.get('model') as File
		const optionsStr = formData.get('options') as string

		if (!modelFile) {
			return data({ error: 'No model file provided' }, { status: 400 })
		}

		// Parse texture compression options
		let options: TextureCompressOptions = {
			resize: [2048, 2048],
			quality: 80,
			targetFormat: 'webp'
		}

		if (optionsStr) {
			try {
				options = JSON.parse(optionsStr)
			} catch {
				return data({ error: 'Invalid options JSON format' }, { status: 400 })
			}
		}

		// Convert file to buffer
		const buffer = new Uint8Array(await modelFile.arrayBuffer())

		// Initialize the model optimizer
		const optimizer = new ModelOptimizer()

		// Set up progress tracking (optional)
		optimizer.onProgress((_progress) => {
			// console.log(
			// 	`Texture optimization: ${progress.operation} - ${progress.progress}%`
			// )
		})

		// Load the model
		await optimizer.loadFromBuffer(buffer)

		// Apply texture compression with Sharp
		await optimizer.compressTextures({
			quality: options.quality || 80,
			targetFormat: options.targetFormat || 'webp',
			...options
		})

		// Export the optimized model
		const optimizedBuffer = await optimizer.exportJSON()

		// Get optimization report for the response header
		const report = await optimizer.getReport()

		// Return the optimized model as binary response
		const headers = new Headers({
			'Content-Type': 'model/gltf-binary',
			'Content-Disposition': `attachment; filename="optimized_${modelFile.name}"`,
			'X-Optimization-Report': JSON.stringify({
				originalSize: report.originalSize,
				optimizedSize: report.optimizedSize,
				compressionRatio: report.compressionRatio,
				textureOptimizations: report.appliedOptimizations.filter(
					(opt: string) => opt.includes('texture')
				)
			})
		})

		return data(optimizedBuffer, { headers })
	} catch (error) {
		console.error('Texture optimization failed:', error)

		// Provide more specific error messages
		let errorMessage = 'Texture optimization failed'
		let statusCode = 500

		if (error instanceof Error) {
			if (error.message.includes('Sharp')) {
				errorMessage =
					'Sharp image processing library not available in server environment'
			} else if (error.message.includes('Failed to load')) {
				errorMessage = 'Invalid model file format'
				statusCode = 400
			} else {
				errorMessage = error.message
			}
		}

		return data(
			{
				error: errorMessage,
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: statusCode }
		)
	}
}
