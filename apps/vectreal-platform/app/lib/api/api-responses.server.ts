import type { ApiResponse } from '../../types/api'

/**
 * Utility class for creating standardized API responses.
 * Follows the Builder pattern for consistent response creation.
 */
export class ApiResponseBuilder {
	/**
	 * Creates a successful API response.
	 * @template T The type of the response data
	 * @param data - The response data
	 * @param status - HTTP status code (defaults to 200)
	 * @returns Standardized success Response
	 */
	static success<T>(data: T, status = 200): Response {
		const response: ApiResponse<T> = {
			data,
			success: true
		}

		return new Response(JSON.stringify(response), {
			status,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	/**
	 * Creates an error API response.
	 * @param message - Error message
	 * @param status - HTTP status code (defaults to 400)
	 * @returns Standardized error Response
	 */
	static error(message: string, status = 400): Response {
		const response: ApiResponse = {
			error: message,
			success: false
		}

		return new Response(JSON.stringify(response), {
			status,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	/**
	 * Creates a bad request (400) error response.
	 * @param message - Error message
	 * @returns Bad request Response
	 */
	static badRequest(message: string): Response {
		return this.error(message, 400)
	}

	/**
	 * Creates an unauthorized (401) error response.
	 * @param message - Error message (defaults to 'Authentication required')
	 * @returns Unauthorized Response
	 */
	static unauthorized(message = 'Authentication required'): Response {
		return this.error(message, 401)
	}

	/**
	 * Creates a forbidden (403) error response.
	 * @param message - Error message (defaults to 'Access denied')
	 * @returns Forbidden Response
	 */
	static forbidden(message = 'Access denied'): Response {
		return this.error(message, 403)
	}

	/**
	 * Creates a not found (404) error response.
	 * @param message - Error message (defaults to 'Resource not found')
	 * @returns Not found Response
	 */
	static notFound(message = 'Resource not found'): Response {
		return this.error(message, 404)
	}

	/**
	 * Creates a method not allowed (405) error response.
	 * @param message - Error message (defaults to 'Method not allowed')
	 * @returns Method not allowed Response
	 */
	static methodNotAllowed(message = 'Method not allowed'): Response {
		return this.error(message, 405)
	}

	/**
	 * Creates an internal server error (500) response.
	 * @param message - Error message
	 * @returns Internal server error Response
	 */
	static serverError(message: string): Response {
		return this.error(message, 500)
	}

	/**
	 * Creates a created (201) success response.
	 * @template T The type of the response data
	 * @param data - The created resource data
	 * @returns Created success Response
	 */
	static created<T>(data: T): Response {
		return this.success(data, 201)
	}
}
