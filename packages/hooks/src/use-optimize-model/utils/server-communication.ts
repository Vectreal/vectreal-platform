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

import type { ServerOptions } from '@vctrl/core'
import type { TextureCompressOptions } from '@vctrl/core/model-optimizer'

import { ServerCommunicationService } from '../../utils/server-communication'

/**
 * Prepares FormData for texture optimization request.
 */
export const prepareTextureOptimizationFormData = async (
	modelBuffer: Uint8Array,
	options?: TextureCompressOptions
): Promise<FormData> => {
	return ServerCommunicationService.prepareTextureOptimizationFormData(
		modelBuffer,
		options as Record<string, unknown> | undefined
	)
}

/**
 * Performs the HTTP request to the texture optimization server.
 */
export const performTextureOptimizationRequest = async (
	serverOptions: ServerOptions & Required<Pick<ServerOptions, 'endpoint'>>,
	formData: FormData
): Promise<Response> => {
	return fetch(serverOptions.endpoint, {
		method: 'POST',
		headers: ServerCommunicationService.createRequestHeaders(serverOptions),
		body: formData
	})
}
