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
	'not_found',
	/** The method is not one this route answers. */
	'method_not_allowed',
	/** The user's role in the organization does not allow this, whatever the scope. */
	'insufficient_role',
	/** A plan limit; `quota` and `upgradeUrl` say which and where to raise it. */
	'quota_exceeded',
	/** The plan does not include this; `upgradeUrl` says where to change plans. */
	'insufficient_plan',
	/** The organization's billing needs attention before this works again. */
	'payment_required',
	/** The scene is a draft; publish it before asking for its embed. */
	'scene_not_published',
	/** Someone is saving the scene right now, in the publisher or another agent. Retry shortly. */
	'scene_busy',
	/** The project has no embed key that works; create one first. */
	'embed_key_required',
	/** The embed key asked for is revoked or expired; pick or create another. */
	'embed_key_unusable',
	/** This Idempotency-Key was first sent with a different request. Use a new one. */
	'idempotency_key_reused',
	/** The first request with this Idempotency-Key is still running. Retry shortly. */
	'idempotency_in_progress'
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]
