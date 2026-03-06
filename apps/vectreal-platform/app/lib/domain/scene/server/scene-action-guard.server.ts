import { and, eq, lt, sql } from 'drizzle-orm'

import { getDbClient } from '../../../../db/client'
import {
	sceneActionLocks,
	sceneActionRequests,
	sceneRuntimeLimits
} from '../../../../db/schema'

const HEAVY_SCENE_ACTION_LIMIT_KEY = 'heavy_scene_actions'
const DEFAULT_IDEMPOTENCY_TTL_HOURS = 24
const DEFAULT_LOCK_LEASE_MS = 20_000

function toDateWithHoursFromNow(hours: number): Date {
	return new Date(Date.now() + hours * 60 * 60 * 1000)
}

export function buildSceneRequestKey(params: {
	requestId: string
	userId: string
	action: string
	sceneId?: string
}): string {
	const { requestId, userId, action, sceneId } = params
	return `${userId}:${action}:${sceneId ?? 'none'}:${requestId}`
}

export async function reserveIdempotentSceneRequest(params: {
	requestKey: string
	requestId: string
	userId: string
	action: string
	sceneId?: string
}) {
	const db = getDbClient()

	await db
		.delete(sceneActionRequests)
		.where(lt(sceneActionRequests.expiresAt, new Date()))

	const existing = await db
		.select()
		.from(sceneActionRequests)
		.where(eq(sceneActionRequests.requestKey, params.requestKey))
		.limit(1)

	if (existing.length > 0) {
		return { record: existing[0], created: false }
	}

	try {
		const [created] = await db
			.insert(sceneActionRequests)
			.values({
				requestKey: params.requestKey,
				requestId: params.requestId,
				userId: params.userId,
				action: params.action,
				sceneId: params.sceneId,
				status: 'pending',
				expiresAt: toDateWithHoursFromNow(DEFAULT_IDEMPOTENCY_TTL_HOURS)
			})
			.returning()

		return { record: created, created: true }
	} catch {
		const [raceWinner] = await db
			.select()
			.from(sceneActionRequests)
			.where(eq(sceneActionRequests.requestKey, params.requestKey))
			.limit(1)

		return raceWinner ? { record: raceWinner, created: false } : null
	}
}

export async function completeIdempotentSceneRequest(params: {
	requestKey: string
	responseStatus: number
	responseBody: unknown
}) {
	const db = getDbClient()

	await db
		.update(sceneActionRequests)
		.set({
			status: 'completed',
			responseStatus: params.responseStatus,
			responseBody: params.responseBody as object,
			errorMessage: null,
			updatedAt: new Date(),
			expiresAt: toDateWithHoursFromNow(DEFAULT_IDEMPOTENCY_TTL_HOURS)
		})
		.where(eq(sceneActionRequests.requestKey, params.requestKey))
}

export async function failIdempotentSceneRequest(params: {
	requestKey: string
	errorMessage: string
}) {
	const db = getDbClient()

	await db
		.update(sceneActionRequests)
		.set({
			status: 'failed',
			errorMessage: params.errorMessage,
			updatedAt: new Date(),
			expiresAt: toDateWithHoursFromNow(1)
		})
		.where(eq(sceneActionRequests.requestKey, params.requestKey))
}

export async function acquireHeavySceneActionToken(
	maxInFlight: number
): Promise<boolean> {
	const db = getDbClient()

	await db
		.insert(sceneRuntimeLimits)
		.values({
			key: HEAVY_SCENE_ACTION_LIMIT_KEY,
			inFlight: 0
		})
		.onConflictDoNothing()

	const updated = await db
		.update(sceneRuntimeLimits)
		.set({
			inFlight: sql`${sceneRuntimeLimits.inFlight} + 1`,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(sceneRuntimeLimits.key, HEAVY_SCENE_ACTION_LIMIT_KEY),
				sql`${sceneRuntimeLimits.inFlight} < ${maxInFlight}`
			)
		)
		.returning({ inFlight: sceneRuntimeLimits.inFlight })

	return updated.length > 0
}

export async function releaseHeavySceneActionToken() {
	const db = getDbClient()

	await db
		.update(sceneRuntimeLimits)
		.set({
			inFlight: sql`greatest(${sceneRuntimeLimits.inFlight} - 1, 0)`,
			updatedAt: new Date()
		})
		.where(eq(sceneRuntimeLimits.key, HEAVY_SCENE_ACTION_LIMIT_KEY))
}

export async function acquireSceneWriteLock(params: {
	sceneId: string
	holderKey: string
	leaseMs?: number
}): Promise<boolean> {
	const db = getDbClient()
	const leaseMs = params.leaseMs ?? DEFAULT_LOCK_LEASE_MS

	const result = await db.execute(sql`
		insert into scene_action_locks (scene_id, holder_key, expires_at, created_at, updated_at)
		values (
			${params.sceneId}::uuid,
			${params.holderKey},
			now() + (${leaseMs} || ' milliseconds')::interval,
			now(),
			now()
		)
		on conflict (scene_id) do update
		set
			holder_key = excluded.holder_key,
			expires_at = excluded.expires_at,
			updated_at = now()
		where scene_action_locks.expires_at < now()
			or scene_action_locks.holder_key = ${params.holderKey}
		returning scene_id
	`)

	const resultWithCount = result as unknown as {
		rowCount?: number
		count?: number
		length?: number
	}

	return (
		(resultWithCount.rowCount ??
			resultWithCount.count ??
			resultWithCount.length ??
			0) > 0
	)
}

export async function releaseSceneWriteLock(params: {
	sceneId: string
	holderKey: string
}) {
	const db = getDbClient()

	await db
		.delete(sceneActionLocks)
		.where(
			and(
				eq(sceneActionLocks.sceneId, params.sceneId),
				eq(sceneActionLocks.holderKey, params.holderKey)
			)
		)
}
