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

import { type ServerOptions, type TextureCompressOptions } from '@vctrl/core'

/**
 * Creates default server options with required endpoint.
 */
export const createDefaultServerOptions = (
	serverOptions?: ServerOptions
): ServerOptions & Required<Pick<ServerOptions, 'endpoint'>> => {
	return {
		endpoint: '/api/optimize-textures',
		...serverOptions
	}
}

/**
 * Prepares FormData for texture optimization request.
 */
export const prepareTextureOptimizationFormData = async (
	modelBuffer: Uint8Array,
	options?: TextureCompressOptions
): Promise<FormData> => {
	const requestData = new FormData()

	requestData.append(
		'model',
		new Blob([new Uint8Array(modelBuffer)], {
			type: 'model/gltf-binary'
		}),
		'model.glb'
	)

	requestData.append(
		'options',
		JSON.stringify({
			...options,
			serverOptions: undefined // Remove serverOptions to avoid circular reference
		})
	)

	return requestData
}

/**
 * Creates request headers for server communication.
 */
export const createRequestHeaders = (
	serverOptions: ServerOptions
): HeadersInit => {
	return {
		// Include API key if provided
		...(serverOptions.apiKey
			? { Authorization: `Bearer ${serverOptions.apiKey}` }
			: {}),
		...serverOptions.headers
	}
}

/**
 * Performs the HTTP request to the texture optimization server.
 */
export const performTextureOptimizationRequest = async (
	serverOptions: ServerOptions & Required<Pick<ServerOptions, 'endpoint'>>,
	formData: FormData
): Promise<Response> => {
	const response = await fetch(serverOptions.endpoint, {
		method: 'POST',
		headers: createRequestHeaders(serverOptions),
		body: formData
	})

	return response
}

/**
 * Extracts error message from a failed response.
 */
export const extractErrorMessage = async (
	response: Response
): Promise<string> => {
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
export const handleServerResponseError = async (
	response: Response
): Promise<never> => {
	const errorMessage = await extractErrorMessage(response)
	throw new Error(errorMessage)
}
