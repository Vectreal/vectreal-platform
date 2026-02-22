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

import { TextureCompressOptions } from '@vctrl/core'
import { data } from 'react-router'

import { Route } from './+types/optimize-textures'
import { ensurePost } from '../../lib/http/requests.server'

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
 * - texture: image file blob
 * - textureIndex: numeric texture index in source model
 * - textureName: original texture name
 * - options: JSON string with TextureCompressOptions
 */
export async function action({ request }: Route.ActionArgs) {
	const methodCheck = ensurePost(request)
	if (methodCheck) {
		return methodCheck
	}

	try {
		const formData = await request.formData()
		const textureFile = formData.get('texture')
		const textureIndexRaw = formData.get('textureIndex')
		const textureNameRaw = formData.get('textureName')
		const optionsStr = formData.get('options') as string
		const textureIndex =
			typeof textureIndexRaw === 'string'
				? Number.parseInt(textureIndexRaw, 10)
				: Number.NaN
		const textureName =
			typeof textureNameRaw === 'string' && textureNameRaw.trim().length > 0
				? textureNameRaw.trim()
				: `texture-${Number.isFinite(textureIndex) ? textureIndex : 'unknown'}`

		if (!(textureFile instanceof File)) {
			return data(
				{ error: 'No texture file provided' },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		if (!Number.isFinite(textureIndex) || textureIndex < 0) {
			return data(
				{ error: 'Invalid or missing textureIndex' },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		let options: TextureCompressOptions = {
			resize: [2048, 2048],
			quality: 80,
			targetFormat: 'webp'
		}

		if (optionsStr) {
			try {
				options = JSON.parse(optionsStr)
			} catch {
				return data(
					{ error: 'Invalid options JSON format' },
					{ status: 400, headers: { 'Cache-Control': 'no-store' } }
				)
			}
		}

		const inputBuffer = Buffer.from(await textureFile.arrayBuffer())
		const sharpModule = await import('sharp')
		const sharp = sharpModule.default || sharpModule

		if (typeof sharp !== 'function') {
			throw new Error('Sharp image processing library is not available')
		}

		let transform = sharp(inputBuffer, { animated: false })

		if (Array.isArray(options.resize) && options.resize.length === 2) {
			transform = transform.resize(options.resize[0], options.resize[1], {
				fit: 'inside',
				withoutEnlargement: true
			})
		}

		const quality = typeof options.quality === 'number' ? options.quality : 80
		const targetFormat = options.targetFormat || 'webp'
		let outputMimeType = 'image/webp'

		switch (targetFormat) {
			case 'jpeg':
				transform = transform.jpeg({ quality })
				outputMimeType = 'image/jpeg'
				break
			case 'png':
				transform = transform.png({ quality })
				outputMimeType = 'image/png'
				break
			case 'webp':
			default:
				transform = transform.webp({ quality })
				outputMimeType = 'image/webp'
				break
		}

		const optimizedTexture = await transform.toBuffer()

		if (optimizedTexture.byteLength === 0) {
			throw new Error('Texture optimization produced an empty output payload')
		}

		return new Response(optimizedTexture, {
			status: 200,
			headers: {
				'Content-Type': outputMimeType,
				'Cache-Control': 'no-store',
				'X-Texture-Index': String(textureIndex),
				'X-Texture-Name': textureName
			}
		})
	} catch (error) {
		console.error('Texture optimization failed:', error)

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
			{ status: statusCode, headers: { 'Cache-Control': 'no-store' } }
		)
	}
}
