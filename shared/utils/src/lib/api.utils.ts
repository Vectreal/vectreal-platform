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
		additionalHeaders.forEach((value, key) => {
			if (key.toLowerCase() === 'set-cookie') {
				headers.append(key, value)
				return
			}

			headers.set(key, value)
		})
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

	/**
	 * 402 Payment Required — the organisation's plan is inactive (e.g. canceled,
	 * unpaid).  Carries a machine-readable `quota` envelope so clients can show
	 * the appropriate upgrade prompt.
	 */
	static paymentRequired(
		message: string,
		quota?: {
			limitKey: string
			currentValue?: number
			limit?: number | null
			plan?: string
			upgradeTo?: string | null
		}
	): Response {
		const body: { success: false; error: string; quota?: typeof quota } = {
			success: false,
			error: message
		}
		if (quota) {
			body.quota = quota
		}
		return new Response(JSON.stringify(body), {
			status: 402,
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
		})
	}

	/**
	 * 403 Quota Exceeded — the organisation has consumed the hard quota for the
	 * requested resource.  Carries a machine-readable `quota` envelope so
	 * clients can show the appropriate upgrade prompt.
	 */
	static quotaExceeded(
		message: string,
		quota: {
			limitKey: string
			currentValue: number
			limit: number | null
			plan: string
			upgradeTo?: string | null
		}
	): Response {
		return new Response(
			JSON.stringify({ success: false, error: message, quota }),
			{
				status: 403,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store'
				}
			}
		)
	}
}
