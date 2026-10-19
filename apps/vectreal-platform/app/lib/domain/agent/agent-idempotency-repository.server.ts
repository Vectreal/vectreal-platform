import { and, eq, isNull, lt, sql } from 'drizzle-orm'

import { getDbClient, type DbTransaction } from '../../../db/client'
import { agentIdempotencyKeys } from '../../../db/schema/auth/agent-idempotency-keys'

const db = getDbClient()

type KeyRef = { grantId: string; key: string }
/** A key as held by one request: only that request may complete or release it. */
export type KeyClaim = KeyRef & { claimId: string }

export type IdempotencyRecord = typeof agentIdempotencyKeys.$inferSelect

const matches = ({ grantId, key }: KeyRef) =>
	and(
		eq(agentIdempotencyKeys.grantId, grantId),
		eq(agentIdempotencyKeys.key, key)
	)

const held = (claim: KeyClaim) =>
	and(matches(claim), eq(agentIdempotencyKeys.claimId, claim.claimId))

/** The database's clock minus `ms`, so app-server clock skew moves no window. */
const ago = (ms: number) => sql`now() - make_interval(secs => ${ms / 1000})`

/** Forgets this grant's keys older than `ms`, so an expired key is free again. */
export async function purgeExpiredIdempotencyKeys(
	grantId: string,
	ms: number
): Promise<void> {
	await db
		.delete(agentIdempotencyKeys)
		.where(
			and(
				eq(agentIdempotencyKeys.grantId, grantId),
				lt(agentIdempotencyKeys.createdAt, ago(ms))
			)
		)
}

/**
 * Takes the key for a request about to run, or `null` when another request
 * holds it already: the primary key makes the claim atomic, so two concurrent
 * requests with one key never both run.
 */
export async function claimIdempotencyKey(
	ref: KeyRef & { fingerprint: string }
): Promise<KeyClaim | null> {
	const [claimed] = await db
		.insert(agentIdempotencyKeys)
		.values(ref)
		.onConflictDoNothing()
		.returning({ claimId: agentIdempotencyKeys.claimId })
	return claimed ? { ...ref, claimId: claimed.claimId } : null
}

export async function findIdempotencyKey(
	ref: KeyRef
): Promise<IdempotencyRecord | undefined> {
	const [row] = await db
		.select()
		.from(agentIdempotencyKeys)
		.where(matches(ref))
		.limit(1)
	return row
}

/**
 * Takes over a claim open for longer than `ms`, whose request presumably
 * died. Safe because an owner's work and its outcome commit together
 * (`completeIdempotencyKey`): a dead owner left nothing behind, and a slow one
 * finds its claim gone and rolls back.
 */
export async function reclaimStaleIdempotencyKey(
	ref: KeyRef,
	ms: number
): Promise<KeyClaim | null> {
	const [reclaimed] = await db
		.update(agentIdempotencyKeys)
		.set({ claimId: sql`gen_random_uuid()`, createdAt: sql`now()` })
		.where(
			and(
				matches(ref),
				isNull(agentIdempotencyKeys.statusCode),
				lt(agentIdempotencyKeys.createdAt, ago(ms))
			)
		)
		.returning({ claimId: agentIdempotencyKeys.claimId })
	return reclaimed ? { ...ref, claimId: reclaimed.claimId } : null
}

/**
 * Keeps the outcome, inside the transaction that made it. False when the
 * claim was taken over meanwhile: the caller must roll back.
 */
export async function completeIdempotencyKey(
	tx: DbTransaction,
	claim: KeyClaim,
	outcome: { statusCode: number; responseBody: unknown }
): Promise<boolean> {
	const completed = await tx
		.update(agentIdempotencyKeys)
		.set(outcome)
		.where(and(held(claim), isNull(agentIdempotencyKeys.statusCode)))
		.returning({ key: agentIdempotencyKeys.key })
	return completed.length > 0
}

/** Frees a key whose request failed without changing anything. */
export async function releaseIdempotencyKey(claim: KeyClaim): Promise<void> {
	await db
		.delete(agentIdempotencyKeys)
		.where(and(held(claim), isNull(agentIdempotencyKeys.statusCode)))
}

export function inIdempotencyTransaction<T>(
	run: (tx: DbTransaction) => Promise<T>
): Promise<T> {
	return db.transaction(run)
}
