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

import { validateServerResponse } from './validation'
import { ServerCommunicationService } from '../../utils/server-communication'

import type {
	ModelOptimizer,
	TextureCompressOptions,
	TextureDescriptor
} from '@vctrl/core/model-optimizer'

const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_MAX_TEXTURE_UPLOAD_BYTES = 50 * 1024 * 1024
const DEFAULT_MAX_CONCURRENT_REQUESTS = 4
const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

const wait = async (ms: number): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

const resolveTextureMimeType = (response: Response): string => {
	const contentType = response.headers.get('content-type')
	if (!contentType) {
		return 'application/octet-stream'
	}

	return contentType.split(';')[0]?.trim() || 'application/octet-stream'
}

const resolveCanonicalTextureFileName = (response: Response): string => {
	const responseFileName =
		response.headers.get('X-Texture-File-Name') ||
		response.headers.get('X-Texture-Name')

	if (!responseFileName || responseFileName.trim().length === 0) {
		throw new Error(
			'Optimized texture response is missing a canonical file name'
		)
	}

	return responseFileName.trim()
}

const requestSingleTextureOptimization = async (
	endpoint: string,
	headers: HeadersInit,
	body: ArrayBuffer,
	requestTimeoutMs: number,
	maxRetries: number
): Promise<Response> => {
	let attempt = 0

	while (true) {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs)

		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers,
				body,
				signal: controller.signal
			})

			if (
				!response.ok &&
				TRANSIENT_STATUS_CODES.has(response.status) &&
				attempt < maxRetries
			) {
				attempt += 1
				await wait(200 * attempt + Math.floor(Math.random() * 120))
				continue
			}

			return response
		} catch (error) {
			if (attempt >= maxRetries) {
				throw error
			}

			attempt += 1
			await wait(200 * attempt + Math.floor(Math.random() * 120))
		} finally {
			clearTimeout(timeoutId)
		}
	}
}

const optimizeTexture = async (
	optimizer: ModelOptimizer,
	texture: TextureDescriptor,
	options: TextureCompressOptions,
	serverOptions: ReturnType<
		typeof ServerCommunicationService.createDefaultServerOptions
	>
): Promise<void> => {
	const payload = optimizer.getTexturePayload(texture.index)
	const maxTextureUploadBytes =
		options.maxTextureUploadBytes ?? DEFAULT_MAX_TEXTURE_UPLOAD_BYTES

	if (payload.image.byteLength > maxTextureUploadBytes) {
		throw new Error(
			`Texture ${texture.index} payload (${payload.image.byteLength} bytes) exceeds maxTextureUploadBytes (${maxTextureUploadBytes} bytes). Increase maxTextureUploadBytes to allow optimizing larger source textures.`
		)
	}

	const requestBytes = new Uint8Array(payload.image.byteLength)
	requestBytes.set(payload.image)
	const requestBody = requestBytes.buffer
	const { serverOptions: _, ...restOptions } = options
	const headers = ServerCommunicationService.createRequestHeaders(
		serverOptions,
		{
			'Content-Type': 'application/octet-stream',
			'X-Texture-Index': String(texture.index),
			'X-Texture-Name': payload.fileName,
			'X-Texture-File-Name': payload.fileName,
			'X-Texture-Mime-Type': payload.mimeType,
			'X-Optimize-Options': JSON.stringify(restOptions)
		}
	)

	const response = await requestSingleTextureOptimization(
		serverOptions.endpoint,
		headers,
		requestBody,
		options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS,
		options.maxRetries ?? DEFAULT_MAX_RETRIES
	)

	if (!response.ok) {
		await ServerCommunicationService.handleServerResponseError(response)
	}

	await validateServerResponse(response)

	const responseTextureIndex = Number.parseInt(
		response.headers.get('X-Texture-Index') || '',
		10
	)

	if (
		!Number.isFinite(responseTextureIndex) ||
		responseTextureIndex !== texture.index
	) {
		throw new Error(
			`Texture identity mismatch. Expected ${texture.index}, received ${response.headers.get('X-Texture-Index')}`
		)
	}

	const optimizedTextureBytes = new Uint8Array(await response.arrayBuffer())
	if (optimizedTextureBytes.byteLength === 0) {
		throw new Error(`Empty optimized payload for texture ${texture.index}`)
	}

	const canonicalFileName = resolveCanonicalTextureFileName(response)

	optimizer.replaceTexturePayload(
		texture.index,
		optimizedTextureBytes,
		resolveTextureMimeType(response),
		canonicalFileName
	)
}

/**
 * Performs server-side texture optimization.
 */
export const performServerSideTextureOptimization = async (
	optimizer: ModelOptimizer,
	options: TextureCompressOptions
): Promise<void> => {
	const serverOptions = ServerCommunicationService.createDefaultServerOptions(
		options.serverOptions
	)
	const textures = optimizer.listTextureDescriptors()
	const failures: Array<{ index: number; reason: string }> = []
	let successCount = 0
	const maxConcurrentRequests =
		options.maxConcurrentRequests ?? DEFAULT_MAX_CONCURRENT_REQUESTS

	try {
		for (
			let start = 0;
			start < textures.length;
			start += maxConcurrentRequests
		) {
			const chunk = textures.slice(start, start + maxConcurrentRequests)
			const settled = await Promise.allSettled(
				chunk.map(async (texture) => {
					await optimizeTexture(optimizer, texture, options, serverOptions)
					return texture.index
				})
			)

			for (const [index, outcome] of settled.entries()) {
				if (outcome.status === 'fulfilled') {
					successCount += 1
					continue
				}

				failures.push({
					index: chunk[index].index,
					reason:
						outcome.reason instanceof Error
							? outcome.reason.message
							: String(outcome.reason)
				})
			}
		}

		if (successCount > 0) {
			optimizer.addAppliedOptimization('texture compression')
		}

		if (failures.length > 0) {
			const failureSummary = failures
				.map((failure) => `#${failure.index}: ${failure.reason}`)
				.join('; ')
			const prefix =
				successCount === 0
					? 'Texture optimization failed for all textures.'
					: `Texture optimization failed for ${failures.length} of ${textures.length} textures.`

			throw new Error(`${prefix} ${failureSummary}`)
		}
	} catch (err) {
		console.error('Server-side texture compression failed:', err)
		throw new Error(
			`Server-side texture compression failed: ${err}. Client-side texture compression is not supported in browser environments.`,
			{ cause: err }
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
