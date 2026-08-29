/**
 * The one response shape GoTrue reads a reason out of.
 *
 * Our route answered a Resend failure with a plain 500 and
 * `{"success": false, "error": "..."}`. GoTrue discards both halves of that:
 * `hookshttp` only calls `hookserrors.Check(body)` on 200 and 202, and
 * `hookserrors` expects `error` to be an *object*, so a string value parses to
 * no error at all. What reached the sign-up action instead was GoTrue's own
 * "Unexpected status code returned from hook: 500", which names nothing.
 *
 * Answering 200 for a failure reads wrong and is deliberate: it means "the hook
 * ran and here is its verdict", and the verdict carries the real status. It
 * costs nothing in delivery guarantees, because GoTrue does not retry a 500
 * either - `hookshttp` retries only on a network timeout, or on 429/503 when a
 * `retry-after` header is present.
 */

interface HookErrorEnvelope {
	error: { http_code: number; message: string }
}

/*
  Addresses are stripped before the reason leaves this process. The detailed
  failure is already reported from the route's own catch, where it belongs; this
  copy travels to Supabase and back through an error report, and a recipient
  address has no reason to make that trip.
*/
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/g

export function redactAddresses(text: string): string {
	return text.replace(EMAIL_PATTERN, '[address]')
}

/**
 * Reason the sign-up action classifies, prefixed so it stays recognizable
 * whatever the underlying provider says. Bounded, because it ends up in an
 * error report rather than a log file.
 */
export function buildHookErrorMessage(reason: unknown): string {
	const raw = reason instanceof Error ? reason.message : String(reason ?? '')
	const cleaned = redactAddresses(raw).trim().slice(0, 200)
	return cleaned
		? `Auth email delivery failed: ${cleaned}`
		: 'Auth email delivery failed'
}

/**
 * HTTP 200 carrying a failure verdict, which is the only way GoTrue reads it.
 */
export function hookErrorResponse(message: string, httpCode = 500): Response {
	const body: HookErrorEnvelope = {
		error: { http_code: httpCode, message }
	}
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	})
}
