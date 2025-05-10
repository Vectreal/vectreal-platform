import type { ApiResponseType } from '../types/api-core'

export class ApiResponse {
	static success<T>(data: T, status = 200): Response {
		return new Response(
			JSON.stringify({ success: true, data } as ApiResponseType<T>),
			{
				status,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store'
				}
			}
		)
	}

	static error(message: string, status = 400): Response {
		return new Response(
			JSON.stringify({ success: false, error: message } as ApiResponseType),
			{
				status,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store'
				}
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

	static unauthorized(message = 'Unauthorized'): Response {
		return this.error(message, 401)
	}

	static forbidden(message = 'Forbidden'): Response {
		return this.error(message, 403)
	}

	static notFound(message = 'Resource not found'): Response {
		return this.error(message, 404)
	}

	static serverError(message = 'Internal server error'): Response {
		return this.error(message, 500)
	}
}
