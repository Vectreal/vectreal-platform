import type { ApiErrorCode, ApiFailure } from '@vctrl/sdk'

/**
 * Every `/api/v1` refusal, in the one shape `@vctrl/sdk` reads: the envelope's
 * message plus a stable `code` an agent can branch on. A v1 route never calls
 * `ApiResponse.error`, whose body has no code.
 *
 * Pure, so the gate and its tests can build refusals without a database.
 */
export function agentApiError(
	status: number,
	code: ApiErrorCode,
	message: string,
	options: {
		headers?: Record<string, string>
		/** Fields beside the message, such as the `scope` a refusal names. */
		extra?: Record<string, unknown>
	} = {}
): Response {
	const body = {
		...options.extra,
		success: false,
		error: message,
		code
	} satisfies ApiFailure

	return Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store', ...options.headers }
	})
}
