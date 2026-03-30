import { ApiResponse } from '@shared/utils'

import { csrfSession } from '../sessions/csrf-session.server'

function parseOrigin(value: null | string): null | string {
	if (!value) {
		return null
	}

	try {
		return new URL(value).origin
	} catch {
		return null
	}
}

/**
 * Reject cross-origin mutation requests.
 *
 * This is a defense-in-depth CSRF gate for POST/PUT/PATCH/DELETE handlers.
 */
export function ensureSameOriginMutation(request: Request): Response | null {
	if (request.method === 'GET' || request.method === 'HEAD') {
		return null
	}

	const requestOrigin = new URL(request.url).origin
	const originHeader = parseOrigin(request.headers.get('origin'))

	if (originHeader) {
		if (originHeader !== requestOrigin) {
			return ApiResponse.forbidden('Cross-origin requests are not allowed')
		}

		return null
	}

	const refererHeader = request.headers.get('referer')
	const refererOrigin = parseOrigin(refererHeader)
	if (refererOrigin && refererOrigin !== requestOrigin) {
		return ApiResponse.forbidden('Cross-origin requests are not allowed')
	}

	return null
}

export async function ensureValidCsrfFormData(
	request: Request,
	formData: FormData
): Promise<Response | null> {
	const sameOriginCheck = ensureSameOriginMutation(request)
	if (sameOriginCheck) {
		return sameOriginCheck
	}

	try {
		await csrfSession.validate(formData, request.headers)
		return null
	} catch {
		return ApiResponse.forbidden('Invalid CSRF token')
	}
}
