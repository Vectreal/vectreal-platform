import { agentApiError } from './agent-api-response'
import { fingerprintRequest, readIdempotencyKey } from './agent-idempotency'
import {
	claimIdempotencyKey,
	inIdempotencyTransaction,
	completeIdempotencyKey,
	findIdempotencyKey,
	purgeExpiredIdempotencyKeys,
	reclaimStaleIdempotencyKey,
	releaseIdempotencyKey,
	type IdempotencyRecord
} from './agent-idempotency-repository.server'
import { reportServerError } from '../../observability/report-server-error.server'

import type { DbTransaction } from '../../../db/client'

/** How long a key answers with its first outcome. Published in the API docs. */
export const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000

/**
 * How long an unfinished claim blocks retries before it counts as abandoned,
 * for a request whose instance died mid-flight. Far longer than any mutation
 * takes; a slow one that is taken over anyway rolls back rather than running
 * twice.
 */
export const STALE_CLAIM_MS = 2 * 60 * 1000

/**
 * Runs an agent mutation at most once per `Idempotency-Key`, the way
 * draft-ietf-httpapi-idempotency-key-header describes:
 *
 * - no key, or a malformed one: 400, nothing runs;
 * - a new key: the mutation runs and its outcome is kept for a day;
 * - the same key again with the same request: the kept outcome, success or
 *   refusal, with `Idempotent-Replayed: true`;
 * - the same key while the first request still runs: 409;
 * - the same key with a different request: 422.
 *
 * `run` gets the transaction its writes must use: they commit together with
 * the kept outcome or not at all. That is what makes a retry safe whatever
 * failed, and what lets an abandoned claim be taken over. A 5xx or an
 * exception rolls back and releases the key, so the retry runs.
 *
 * Call it after `authorizeAgentRequest`, so a refusal there never takes a key.
 */
export async function withIdempotency(
	{
		grantId,
		request,
		payload
	}: { grantId: string; request: Request; payload: unknown },
	run: (tx: DbTransaction) => Promise<Response>
): Promise<Response> {
	const key = readIdempotencyKey(request)
	if (!key) {
		throw agentApiError(
			400,
			'invalid_request',
			'Send an Idempotency-Key header with every change: a unique string of up to 255 printable ASCII characters, sent again only to retry it.'
		)
	}

	const ref = { grantId, key }
	const fingerprint = fingerprintRequest(request, payload)
	await purgeExpiredIdempotencyKeys(grantId, IDEMPOTENCY_KEY_TTL_MS)

	let claim = await claimIdempotencyKey({ ...ref, fingerprint })
	if (!claim) {
		const existing = await findIdempotencyKey(ref)
		const replay = existing && answerHeldKey(existing, fingerprint)
		if (replay) return replay

		// Gone between the claim and the read (released by a failed first
		// try), or abandoned by a request that never finished.
		claim = existing
			? await reclaimStaleIdempotencyKey(ref, STALE_CLAIM_MS)
			: await claimIdempotencyKey({ ...ref, fingerprint })
		if (!claim) throw inProgress()
	}
	const held = claim

	try {
		return await inIdempotencyTransaction(async (tx) => {
			const response = await run(tx).catch((error: unknown) => {
				if (error instanceof Response) return error
				throw error
			})
			if (response.status >= 500) throw new RolledBack(response)

			const kept = await completeIdempotencyKey(tx, held, {
				statusCode: response.status,
				responseBody: await response.clone().json()
			})
			if (!kept) throw new ClaimTakenOver()
			return response
		})
	} catch (error) {
		// Another request holds the key now and does the work; ours is undone.
		if (error instanceof ClaimTakenOver) throw inProgress()

		await releaseIdempotencyKey(held).catch((releaseError: unknown) =>
			reportServerError(releaseError, { request })
		)
		if (error instanceof RolledBack) return error.response
		throw error
	}
}

/** Carries a 5xx out of the transaction, rolling back whatever it wrote. */
class RolledBack extends Error {
	constructor(readonly response: Response) {
		super('rolled back after a 5xx')
	}
}

class ClaimTakenOver extends Error {}

/** The answer for a key another request already holds, or `null` to try taking it. */
function answerHeldKey(
	existing: IdempotencyRecord,
	fingerprint: string
): Response | null {
	if (existing.fingerprint !== fingerprint) {
		throw agentApiError(
			422,
			'idempotency_key_reused',
			'This Idempotency-Key was already used for a different request. Use a new key for a new operation.'
		)
	}
	if (existing.statusCode === null) return null

	return Response.json(existing.responseBody, {
		status: existing.statusCode,
		headers: { 'Cache-Control': 'no-store', 'Idempotent-Replayed': 'true' }
	})
}

function inProgress(): Response {
	return agentApiError(
		409,
		'idempotency_in_progress',
		'A request with this Idempotency-Key is still running. Retry with the same key in a moment.',
		{ headers: { 'Retry-After': '1' } }
	)
}
