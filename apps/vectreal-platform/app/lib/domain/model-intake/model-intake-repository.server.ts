import { desc, eq, lte, sql } from 'drizzle-orm'

import {
	addRetentionDays,
	cleanupMinutesBetween,
	type ModelIntakeOutcome
} from './model-intake-shared'
import { getDbClient } from '../../../db/client'
import { modelIntakeSubmissions } from '../../../db/schema'

export type ModelIntakeRow = typeof modelIntakeSubmissions.$inferSelect
export type NewModelIntakeRow = typeof modelIntakeSubmissions.$inferInsert

export async function insertIntakeSubmission(
	row: NewModelIntakeRow
): Promise<void> {
	await getDbClient().insert(modelIntakeSubmissions).values(row)
}

export async function setIntakeEmailStatus(
	id: string,
	emailStatus: ModelIntakeRow['emailStatus']
): Promise<void> {
	await getDbClient()
		.update(modelIntakeSubmissions)
		.set({ emailStatus, updatedAt: new Date() })
		.where(eq(modelIntakeSubmissions.id, id))
}

/**
 * What the internal page lists. Name, email, company and message stay
 * encrypted and are not selected: the notification email already carried them
 * to the inbox, and the page has no reason to decrypt them again.
 */
export async function listIntakeSubmissions() {
	return getDbClient()
		.select({
			id: modelIntakeSubmissions.id,
			referenceCode: modelIntakeSubmissions.referenceCode,
			locale: modelIntakeSubmissions.locale,
			batch: modelIntakeSubmissions.batch,
			productType: modelIntakeSubmissions.productType,
			heightCm: modelIntakeSubmissions.heightCm,
			widthCm: modelIntakeSubmissions.widthCm,
			depthCm: modelIntakeSubmissions.depthCm,
			photoPaths: modelIntakeSubmissions.photoPaths,
			status: modelIntakeSubmissions.status,
			emailStatus: modelIntakeSubmissions.emailStatus,
			cleanupStartedAt: modelIntakeSubmissions.cleanupStartedAt,
			cleanupFinishedAt: modelIntakeSubmissions.cleanupFinishedAt,
			cleanupMinutes: modelIntakeSubmissions.cleanupMinutes,
			outcome: modelIntakeSubmissions.outcome,
			deliveredAt: modelIntakeSubmissions.deliveredAt,
			deleteAfter: modelIntakeSubmissions.deleteAfter,
			createdAt: modelIntakeSubmissions.createdAt
		})
		.from(modelIntakeSubmissions)
		.orderBy(desc(modelIntakeSubmissions.createdAt))
}

export type ModelIntakeListItem = Awaited<
	ReturnType<typeof listIntakeSubmissions>
>[number]

async function updateIntake(
	id: string,
	values: Partial<NewModelIntakeRow>
): Promise<boolean> {
	const rows = await getDbClient()
		.update(modelIntakeSubmissions)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(modelIntakeSubmissions.id, id))
		.returning({ id: modelIntakeSubmissions.id })
	return rows.length > 0
}

/**
 * Starts the clock. Only a new request moves to "in cleanup": redoing a
 * delivered model or one under a pilot keeps its status, and with it the
 * retention date that status set.
 */
export async function startIntakeCleanup(id: string, now: Date) {
	const rows = await getDbClient()
		.update(modelIntakeSubmissions)
		.set({
			status: sql`case when ${modelIntakeSubmissions.status} = 'received' then 'in_cleanup'::model_intake_status else ${modelIntakeSubmissions.status} end`,
			cleanupStartedAt: now,
			cleanupFinishedAt: null,
			cleanupMinutes: null,
			updatedAt: now
		})
		.where(eq(modelIntakeSubmissions.id, id))
		.returning({ id: modelIntakeSubmissions.id })
	return rows.length > 0
}

/**
 * Stops the clock; the minutes come from the two stamps unless given by hand.
 * `not_started` tells a missing request apart from a clock never started.
 */
export async function finishIntakeCleanup(
	id: string,
	now: Date
): Promise<boolean | 'not_started'> {
	const [row] = await getDbClient()
		.select({ cleanupStartedAt: modelIntakeSubmissions.cleanupStartedAt })
		.from(modelIntakeSubmissions)
		.where(eq(modelIntakeSubmissions.id, id))
	if (!row) return false
	if (!row.cleanupStartedAt) return 'not_started'
	return updateIntake(id, {
		cleanupFinishedAt: now,
		cleanupMinutes: cleanupMinutesBetween(row.cleanupStartedAt, now)
	})
}

export function setIntakeCleanupLog(
	id: string,
	values: { cleanupMinutes: number | null; outcome: ModelIntakeOutcome | null }
) {
	return updateIntake(id, values)
}

/** Delivery starts the retention clock over. */
export function markIntakeDelivered(id: string, now: Date) {
	return updateIntake(id, {
		status: 'delivered',
		deliveredAt: now,
		deleteAfter: addRetentionDays(now)
	})
}

/** A booked pilot is governed by its agreement, so the purge stops counting. */
export function markIntakePilotBooked(id: string) {
	return updateIntake(id, { status: 'pilot_booked', deleteAfter: null })
}

export async function findIntakeForDeletion(id: string) {
	const [row] = await getDbClient()
		.select({
			id: modelIntakeSubmissions.id,
			photoPaths: modelIntakeSubmissions.photoPaths
		})
		.from(modelIntakeSubmissions)
		.where(eq(modelIntakeSubmissions.id, id))
	return row ?? null
}

export async function findIntakeByReference(referenceCode: string) {
	const [row] = await getDbClient()
		.select({
			id: modelIntakeSubmissions.id,
			photoPaths: modelIntakeSubmissions.photoPaths
		})
		.from(modelIntakeSubmissions)
		.where(eq(modelIntakeSubmissions.referenceCode, referenceCode))
	return row ?? null
}

export async function selectExpiredIntakes(now: Date) {
	return getDbClient()
		.select({
			id: modelIntakeSubmissions.id,
			photoPaths: modelIntakeSubmissions.photoPaths
		})
		.from(modelIntakeSubmissions)
		.where(lte(modelIntakeSubmissions.deleteAfter, now))
}

export async function deleteIntakeRow(id: string): Promise<void> {
	await getDbClient()
		.delete(modelIntakeSubmissions)
		.where(eq(modelIntakeSubmissions.id, id))
}
