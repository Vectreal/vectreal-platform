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

import type { ServerOptions, TextureCompressOptions } from '@vctrl/core'

/**
 * Configuration for a server request.
 */
export interface ServerRequestConfig {
	/** Server endpoint URL or path */
	endpoint: string
	/** HTTP method (GET, POST, etc.) */
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
	/** Request body (FormData, JSON, or other) */
	body?: FormData | Record<string, unknown> | string
	/** Optional server options (headers, auth, etc.) */
	serverOptions?: ServerOptions
	/** Content type for JSON bodies (default: 'application/json') */
	contentType?: string
}

/**
 * Unified server communication service for handling HTTP requests.
 * Provides a consistent interface for API calls with built-in error handling,
 * authentication, and response parsing.
 *
 * @example
 * ```typescript
 * // Simple GET request
 * const data = await ServerCommunicationService.request<SceneData>({
 *   endpoint: '/api/load-scene',
 *   method: 'GET'
 * })
 *
 * // POST with FormData
 * const formData = new FormData()
 * formData.append('model', file)
 * const result = await ServerCommunicationService.request({
 *   endpoint: '/api/optimize',
 *   method: 'POST',
 *   body: formData,
 *   serverOptions: { apiKey: 'secret' }
 * })
 *
 * // POST with JSON
 * const response = await ServerCommunicationService.request({
 *   endpoint: '/api/save',
 *   method: 'POST',
 *   body: { sceneId: '123', settings: {...} },
 *   serverOptions: { headers: { 'X-Custom': 'value' } }
 * })
 * ```
 */
export class ServerCommunicationService {
	/**
	 * Creates default server options with required endpoint.
	 * Merges provided options with defaults.
	 */
	static createDefaultServerOptions(
		serverOptions?: ServerOptions
	): ServerOptions & Required<Pick<ServerOptions, 'endpoint'>> {
		return {
			endpoint: '/api/optimize-textures',
			...serverOptions
		}
	}

	/**
	 * Creates request headers for server communication.
	 * Includes authentication token if apiKey is provided.
	 */
	static createRequestHeaders(
		serverOptions?: ServerOptions,
		additionalHeaders?: HeadersInit
	): HeadersInit {
		const headers: HeadersInit = {
			...(serverOptions?.apiKey
				? { Authorization: `Bearer ${serverOptions.apiKey}` }
				: {}),
			...serverOptions?.headers,
			...additionalHeaders
		}

		return headers
	}

	/**
	 * Extracts error message from a failed response.
	 * Attempts to parse JSON error data, falls back to text.
	 */
	static async extractErrorMessage(response: Response): Promise<string> {
		let errorMessage = `Server responded with ${response.status}: ${response.statusText}`

		try {
			const contentType = response.headers.get('content-type')
			if (contentType?.includes('application/json')) {
				const errorData = await response.json()
				errorMessage = errorData.error || errorData.details || errorMessage
			} else {
				const errorText = await response.text()
				if (errorText) errorMessage += ` - ${errorText}`
			}
		} catch {
			// Fallback to basic error message if can't parse response
		}

		return errorMessage
	}

	/**
	 * Handles server response errors and throws appropriate errors.
	 */
	static async handleServerResponseError(response: Response): Promise<never> {
		const errorMessage =
			await ServerCommunicationService.extractErrorMessage(response)
		throw new Error(errorMessage)
	}

	/**
	 * Prepares FormData for texture optimization request.
	 * Serializes options and appends model binary.
	 */
	static async prepareTextureOptimizationFormData(
		modelBuffer: Uint8Array,
		options?: TextureCompressOptions
	): Promise<FormData> {
		const requestData = new FormData()

		requestData.append(
			'model',
			new Blob([new Uint8Array(modelBuffer)], {
				type: 'model/gltf-binary'
			}),
			'model.glb'
		)

		if (options) {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { serverOptions: _, ...restOptions } = options
			requestData.append('options', JSON.stringify(restOptions))
		}

		return requestData
	}

	/**
	 * Performs a generic HTTP request with error handling.
	 * Returns parsed response data.
	 *
	 * @template T - Expected response data type
	 * @param config - Request configuration
	 * @returns Promise resolving to parsed response data
	 * @throws Error if request fails or response is not ok
	 */
	static async request<T = unknown>(config: ServerRequestConfig): Promise<T> {
		const {
			endpoint,
			method = 'GET',
			body,
			serverOptions,
			contentType = 'application/json'
		} = config

		// Prepare headers
		const headers: HeadersInit =
			ServerCommunicationService.createRequestHeaders(serverOptions)

		// Prepare request body
		let requestBody: FormData | string | undefined

		if (body instanceof FormData) {
			// Don't set Content-Type for FormData - browser will set it with boundary
			requestBody = body
		} else if (typeof body === 'object' && body !== null) {
			// JSON body
			;(headers as Record<string, string>)['Content-Type'] = contentType
			requestBody = JSON.stringify(body)
		} else if (typeof body === 'string') {
			requestBody = body
		}

		// Perform request
		const response = await fetch(endpoint, {
			method,
			headers,
			body: requestBody
		})

		// Handle errors
		if (!response.ok) {
			await ServerCommunicationService.handleServerResponseError(response)
		}

		// Parse response
		const responseContentType = response.headers.get('content-type')

		if (responseContentType?.includes('application/json')) {
			return (await response.json()) as T
		}

		// For binary responses (e.g., model files)
		if (
			responseContentType?.includes('model/') ||
			responseContentType?.includes('application/octet-stream')
		) {
			const arrayBuffer = await response.arrayBuffer()
			return new Uint8Array(arrayBuffer) as T
		}

		// Default to text
		return (await response.text()) as T
	}

	/**
	 * Performs a GET request.
	 * Convenience method for common GET operations.
	 */
	static async get<T = unknown>(
		endpoint: string,
		serverOptions?: ServerOptions
	): Promise<T> {
		return ServerCommunicationService.request<T>({
			endpoint,
			method: 'GET',
			serverOptions
		})
	}

	/**
	 * Performs a POST request with JSON body.
	 * Convenience method for common POST operations.
	 */
	static async post<T = unknown>(
		endpoint: string,
		body: Record<string, unknown>,
		serverOptions?: ServerOptions
	): Promise<T> {
		return ServerCommunicationService.request<T>({
			endpoint,
			method: 'POST',
			body,
			serverOptions
		})
	}

	/**
	 * Performs a POST request with FormData body.
	 * Convenience method for file uploads.
	 */
	static async postFormData<T = unknown>(
		endpoint: string,
		formData: FormData,
		serverOptions?: ServerOptions
	): Promise<T> {
		return ServerCommunicationService.request<T>({
			endpoint,
			method: 'POST',
			body: formData,
			serverOptions
		})
	}

	/**
	 * Fetches scene data from the server.
	 * Specialized method for loading 3D scenes with their associated settings.
	 *
	 * This method handles the vectreal-platform API format which uses:
	 * - FormData with 'action' and 'sceneId' parameters
	 * - POST request to the scene-settings endpoint
	 * - Returns scene data including GLTF JSON and asset data
	 *
	 * @param sceneId - The unique identifier of the scene to load
	 * @param serverOptions - Optional server configuration (endpoint, auth, headers)
	 * @returns Promise resolving to the scene data
	 * @throws Error if the request fails or scene doesn't exist
	 *
	 * @example
	 * ```typescript
	 * const sceneData = await ServerCommunicationService.loadScene('abc-123', {
	 *   endpoint: '/api/scene-settings',
	 *   apiKey: 'optional-auth-token'
	 * })
	 * ```
	 */
	static async loadScene<T = unknown>(
		sceneId: string,
		serverOptions?: ServerOptions
	): Promise<T> {
		const formData = new FormData()
		formData.append('action', 'get-scene-settings')
		formData.append('sceneId', sceneId)

		const endpoint = serverOptions?.endpoint || '/api/scene-settings'

		const response = await ServerCommunicationService.request<
			{ data?: T; error?: string } | T
		>({
			endpoint,
			method: 'POST',
			body: formData,
			serverOptions
		})

		// Handle both wrapped and unwrapped response formats
		if (
			response &&
			typeof response === 'object' &&
			'data' in response &&
			response.data
		) {
			return response.data as T
		}

		if (
			response &&
			typeof response === 'object' &&
			'error' in response &&
			response.error
		) {
			throw new Error(response.error)
		}

		return response as T
	}
}
