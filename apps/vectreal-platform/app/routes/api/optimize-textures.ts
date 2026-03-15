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

import { ApiResponse } from '@shared/utils'
import { TextureCompressOptions } from '@vctrl/core'
import { data } from 'react-router'

import { Route } from './+types/optimize-textures'
import {
	getOrgSubscription,
	getRecommendedUpgrade
} from '../../lib/domain/billing/entitlement-service.server'
import {
	checkQuota,
	type UsageCheckResult
} from '../../lib/domain/billing/usage-service.server'
import { initializeUserDefaults } from '../../lib/domain/user/user-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'
import { ensurePost } from '../../lib/http/requests.server'

const mimeTypeToExtension = (mimeType: string): string | null => {
	switch (mimeType.toLowerCase()) {
		case 'image/webp':
			return 'webp'
		case 'image/jpeg':
			return 'jpg'
		case 'image/png':
			return 'png'
		default:
			return null
	}
}

const replaceFileExtension = (fileName: string, extension: string): string => {
	const queryIndex = fileName.indexOf('?')
	const hashIndex = fileName.indexOf('#')
	const suffixStart = [queryIndex, hashIndex]
		.filter((index) => index >= 0)
		.reduce((min, index) => Math.min(min, index), Number.POSITIVE_INFINITY)
	const hasSuffix = Number.isFinite(suffixStart)
	const base = hasSuffix ? fileName.slice(0, suffixStart) : fileName
	const suffix = hasSuffix ? fileName.slice(suffixStart) : ''
	const lastSlash = base.lastIndexOf('/')
	const lastDot = base.lastIndexOf('.')
	const hasExtension = lastDot > lastSlash
	const nextBase = hasExtension
		? `${base.slice(0, lastDot)}.${extension}`
		: `${base}.${extension}`

	return `${nextBase}${suffix}`
}

const resolveCanonicalTextureFileName = (
	fileName: string,
	mimeType: string
): string => {
	const fileNameOnly = extractTextureFileName(fileName)
	const extension = mimeTypeToExtension(mimeType)
	if (!extension) {
		return fileNameOnly
	}

	return replaceFileExtension(fileNameOnly, extension)
}

const extractTextureFileName = (value: string): string => {
	const withoutQuery = value.split('?')[0] || value
	const withoutHash = withoutQuery.split('#')[0] || withoutQuery
	const normalized = withoutHash.replace(/\\/g, '/').trim()
	return normalized.split('/').pop() || normalized
}

const GENERIC_TEXTURE_FILE_NAME_PATTERN =
	/^(?:text{1,2}ure|image|img)[-_ ]?\d+(?:\.[a-z0-9]+)?$/i

const isGenericTextureFileName = (value: string): boolean => {
	const trimmed = value.trim()
	if (trimmed.length === 0) {
		return false
	}

	return GENERIC_TEXTURE_FILE_NAME_PATTERN.test(extractTextureFileName(trimmed))
}

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

	// Authenticate the request and enforce the monthly optimization quota
	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	let organizationId: string
	try {
		const userDefaults = await initializeUserDefaults(authResult.user)
		organizationId = userDefaults.organization.id
	} catch {
		return ApiResponse.serverError('Failed to resolve organization')
	}

	const quotaCheck: UsageCheckResult = await checkQuota(
		organizationId,
		'optimization_runs_per_month'
	)

	if (quotaCheck.outcome === 'hard_limit_exceeded') {
		const { plan } = await getOrgSubscription(organizationId)
		const upgradeTo = getRecommendedUpgrade(plan)
		return ApiResponse.quotaExceeded(
			'Monthly optimization limit reached. Upgrade your plan to continue optimizing.',
			{
				limitKey: 'optimization_runs_per_month',
				currentValue: quotaCheck.currentValue,
				limit: quotaCheck.limit,
				plan,
				upgradeTo
			}
		)
	}

	try {
		const contentType = request.headers.get('content-type') || ''
		if (!contentType.includes('application/octet-stream')) {
			return data(
				{
					error:
						'Unsupported content type. optimize-textures requires application/octet-stream payloads.'
				},
				{ status: 415, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		const textureIndexRaw = request.headers.get('x-texture-index')
		const textureNameRaw =
			request.headers.get('x-texture-file-name') ||
			request.headers.get('x-texture-name')
		const optionsStr = request.headers.get('x-optimize-options') || ''
		const textureIndex =
			typeof textureIndexRaw === 'string'
				? Number.parseInt(textureIndexRaw, 10)
				: Number.NaN
		const textureName =
			typeof textureNameRaw === 'string' ? textureNameRaw.trim() : ''

		if (!Number.isFinite(textureIndex) || textureIndex < 0) {
			return data(
				{ error: 'Invalid or missing textureIndex' },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		if (textureName.length === 0) {
			return data(
				{ error: 'Missing canonical texture file name' },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		if (isGenericTextureFileName(textureName)) {
			console.warn('[optimize-textures] Received generic texture file name', {
				textureIndex,
				textureName
			})
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

		const requestBuffer = await request.arrayBuffer()
		if (!requestBuffer.byteLength) {
			return data(
				{ error: 'Texture payload is empty' },
				{ status: 400, headers: { 'Cache-Control': 'no-store' } }
			)
		}

		const inputBuffer = Buffer.from(requestBuffer)
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

		const responseBody = new Uint8Array(optimizedTexture)
		const outputFileName = resolveCanonicalTextureFileName(
			textureName,
			outputMimeType
		)

		return new Response(responseBody, {
			status: 200,
			headers: {
				'Content-Type': outputMimeType,
				'Cache-Control': 'no-store',
				'X-Texture-Index': String(textureIndex),
				'X-Texture-Name': outputFileName,
				'X-Texture-File-Name': outputFileName
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
