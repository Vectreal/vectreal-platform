/**
 * What a v1 refusal carries in `code`, for an agent to branch on rather than
 * parse a message.
 *
 * A server may send a code this list does not have yet: the envelope reads
 * `code` as an open string, so an older client still sees the refusal.
 */
export const API_ERROR_CODES = [
	/** The token is missing, invalid, expired or revoked: sign in again. */
	'invalid_token',
	/** The request itself is malformed, such as a token and a session cookie. */
	'invalid_request',
	/** The grant lacks a scope; `scope` names it. Ask the user to approve it. */
	'insufficient_scope',
	/** Too many requests for this grant; wait `Retry-After` seconds. */
	'rate_limited',
	'not_found'
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]
