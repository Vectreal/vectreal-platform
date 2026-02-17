import { ApiResponse } from '@shared/utils'

export function ensurePost(request: Request): Response | null {
	if (request.method !== 'POST') {
		return ApiResponse.methodNotAllowed()
	}
	return null
}

export async function parseActionRequest(
	request: Request
): Promise<Record<string, unknown>> {
	const contentType = request.headers.get('content-type') || ''

	try {
		if (contentType.includes('application/json')) {
			return await request.json()
		}

		if (
			contentType.includes('multipart/form-data') ||
			contentType.includes('application/x-www-form-urlencoded')
		) {
			const form = await request.formData()
			const obj: Record<string, FormDataEntryValue> = {}
			for (const [k, v] of form.entries()) {
				obj[k] = v
			}
			return obj
		}

		return await request.json()
	} catch (error) {
		console.warn('Failed to parse request body:', error)
		return {}
	}
}
