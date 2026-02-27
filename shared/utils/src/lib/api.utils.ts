import type { ApiResponseType } from '../types/api-core'

function mergeHeaders(
	defaultHeaders: Record<string, string>,
	additionalHeaders?: Headers | Record<string, string>
): Headers {
	const headers = new Headers(defaultHeaders)

	if (!additionalHeaders) {
		return headers
	}

	if (additionalHeaders instanceof Headers) {
		for (const [key, value] of additionalHeaders.entries()) {
			if (key.toLowerCase() === 'set-cookie') {
				headers.append(key, value)
				continue
			}

			headers.set(key, value)
		}
		return headers
	}

	for (const [key, value] of Object.entries(additionalHeaders)) {
		headers.set(key, value)
	}

	return headers
}

export class ApiResponse {
	static success<T>(
		data: T,
		status = 200,
		options?: { headers?: Headers | Record<string, string> }
	): Response {
		const headers = mergeHeaders(
			{
				'Content-Type': 'application/json'
			},
			options?.headers
		)

		return new Response(
			JSON.stringify({ success: true, data } as ApiResponseType<T>),
			{
				status,
				headers
			}
		)
	}

	static error(
		message: string,
		status = 400,
		options?: { headers?: Headers | Record<string, string> }
	): Response {
		const headers = mergeHeaders(
			{
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store'
			},
			options?.headers
		)

		return new Response(
			JSON.stringify({ success: false, error: message } as ApiResponseType),
			{
				status,
				headers
			}
		)
	}

	// Helper method for session cookies
	static withCookie<T>(data: T, cookieHeader: string, status = 200): Response {
		return new Response(
			JSON.stringify({ success: true, data } as ApiResponseType<T>),
			{
				status,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store',
					'Set-Cookie': cookieHeader
				}
			}
		)
	}

	// Standard error responses
	static badRequest(message: string): Response {
		return this.error(message, 400)
	}

	static methodNotAllowed(message = 'Method not allowed'): Response {
		return this.error(message, 405)
	}

	static unauthorized(
		message = 'Unauthorized',
		options?: { headers?: Headers | Record<string, string> }
	): Response {
		return this.error(message, 401, options)
	}

	static forbidden(
		message = 'Forbidden',
		options?: { headers?: Headers | Record<string, string> }
	): Response {
		return this.error(message, 403, options)
	}

	static notFound(
		message = 'Resource not found',
		options?: { headers?: Headers | Record<string, string> }
	): Response {
		return this.error(message, 404, options)
	}

	static serverError(message = 'Internal server error'): Response {
		return this.error(message, 500)
	}

	static created<T>(
		data: T,
		options?: { headers?: Headers | Record<string, string> }
	): Response {
		return this.success(data, 201, options)
	}
}
