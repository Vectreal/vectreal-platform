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

/**
 * Validates that the response contains the expected content type.
 */
export const validateResponseContentType = (response: Response): void => {
	const contentType = response.headers.get('content-type')

	if (!contentType) {
		throw new Error('Missing content type from server response')
	}

	if (contentType.includes('application/json')) {
		throw new Error('Unexpected JSON success response from texture optimizer')
	}

	if (
		!contentType.startsWith('image/') &&
		!contentType.includes('application/octet-stream')
	) {
		throw new Error(`Unexpected content type from server: ${contentType}`)
	}
}

/**
 * Validates a server response and throws appropriate errors.
 */
export const validateServerResponse = async (
	response: Response
): Promise<void> => {
	// First check if the response was successful
	if (!response.ok) {
		return // Error handling is done elsewhere
	}

	// Check content type for successful responses
	const contentType = response.headers.get('content-type')

	if (contentType?.includes('application/json')) {
		// Server returned JSON error despite 200 status
		const errorData = await response.json()
		throw new Error(
			errorData.error || errorData.details || 'Server returned error'
		)
	}

	validateResponseContentType(response)
}
