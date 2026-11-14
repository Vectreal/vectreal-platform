import { apiFailureSchema } from '@vctrl/sdk'

import { agentApiError } from './agent-api-response'

import type { ApiErrorCode } from '@vctrl/sdk'
import type { MiddlewareFunction } from 'react-router'

/**
 * Keeps every `/api/v1` refusal in the envelope `@vctrl/sdk` reads, including
 * the ones no route wrote: React Router answers a method a route has no
 * handler for with its own 405, and an uncaught error with a plain-text 500.
 *
 * A refusal that already carries a `code` came from `agentApiError` and passes
 * through untouched; any other is replaced by the coded refusal for its status.
 * The original body is dropped, which also keeps an error's text off the wire.
 */
export const agentApiEnvelopeMiddleware: MiddlewareFunction<Response> = async (
	{ request },
	next
) =>
	// Nothing before `next()`: a v1 request does no work before the gate knows
	// who is asking, and `tests/agent-api-routes.spec.ts` holds every v1 route
	// to that.
	withAgentApiEnvelope(request, await next())

export async function withAgentApiEnvelope(
	request: Request,
	response: Response
): Promise<Response> {
	if (response.status < 400 || (await carriesCode(response))) return response

	const [code, message] = refusalFor(response.status, request.method)
	return agentApiError(response.status, code, message)
}

async function carriesCode(response: Response): Promise<boolean> {
	const body: unknown = await response
		.clone()
		.json()
		.catch(() => undefined)
	const failure = apiFailureSchema.safeParse(body)
	return failure.success && failure.data.code !== undefined
}

function refusalFor(status: number, method: string): [ApiErrorCode, string] {
	if (status === 404) return ['not_found', 'No such route.']
	if (status === 405) {
		return ['method_not_allowed', `This route does not answer ${method}.`]
	}
	if (status < 500) {
		return ['invalid_request', 'This route cannot answer this request.']
	}
	return ['internal_error', 'Something went wrong on our side. Retry shortly.']
}
