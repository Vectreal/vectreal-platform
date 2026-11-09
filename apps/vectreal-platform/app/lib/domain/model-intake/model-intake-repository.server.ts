import {
	and,
	count,
	countDistinct,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	lte,
	notExists,
	or,
	sql
} from 'drizzle-orm'

import {
	addRetentionDays,
	cleanupMinutesBetween,
	MODEL_INTAKE_RETENTION_DAYS,
	type ModelIntakeAudience,
	type ModelIntakeLocale,
	type ModelIntakeOutcome,
	type ModelIntakeProductType
} from './model-intake-shared'
import { getDbClient } from '../../../db/client'
import {
	modelIntakeLetterScans,
	modelIntakeLetters,
	modelIntakeSubmissions
} from '../../../db/schema'

export type ModelIntakeLetter = Omit<
	typeof modelIntakeLetters.$inferSelect,
	'createdAt'
> & {
	audience: ModelIntakeAudience
	category: ModelIntakeProductType
	locale: ModelIntakeLocale
}

const letterColumns = {
	code: modelIntakeLetters.code,
	organization: modelIntakeLetters.organization,
	audience: modelIntakeLetters.audience,
	category: modelIntakeLetters.category,
	locale: modelIntakeLetters.locale
}

export async function findIntakeLetter(
	code: string
): Promise<ModelIntakeLetter | null> {
	const [row] = await getDbClient()
		.select(letterColumns)
		.from(modelIntakeLetters)
		.where(eq(modelIntakeLetters.code, code))
	return (row as ModelIntakeLetter | undefined) ?? null
}

export async function recordIntakeLetterScan(
	letterCode: string,
	scannedAt: Date
): Promise<void> {
	await getDbClient()
		.insert(modelIntakeLetterScans)
		.values({ letterCode, scannedAt })
}

/**
 * The codes among these already registered for a different letter. Asked
 * before anything is printed or stored, so a reused code can never move
 * earlier replies to another organization.
 */
export async function findConflictingIntakeLetters(
	letters: ModelIntakeLetter[]
): Promise<string[]> {
	if (letters.length === 0) return []
	const stored = await getDbClient()
		.select(letterColumns)
		.from(modelIntakeLetters)
		.where(
			inArray(
				modelIntakeLetters.code,
				letters.map((letter) => letter.code)
			)
		)
	const byCode = new Map(stored.map((row) => [row.code, row]))
	return letters
		.filter((letter) => {
			const row = byCode.get(letter.code)
			return (
				row !== undefined &&
				(row.organization !== letter.organization ||
					row.audience !== letter.audience ||
					row.category !== letter.category ||
					row.locale !== letter.locale)
			)
		})
		.map((letter) => letter.code)
}

/** Records printed letters; one already registered, as a reprint is, stays as it was. */
export async function insertIntakeLetters(
	letters: ModelIntakeLetter[]
): Promise<void> {
	if (letters.length === 0) return
	await getDbClient()
		.insert(modelIntakeLetters)
		.values(letters)
		.onConflictDoNothing()
}

/** The mailing at a glance: letters registered, how many were opened, how many led to a request. */
export async function summarizeIntakeLetters() {
	const db = getDbClient()
	const [[posted], [scanned], [replied]] = await Promise.all([
		db.select({ total: count() }).from(modelIntakeLetters),
		db
			.select({ total: countDistinct(modelIntakeLetterScans.letterCode) })
			.from(modelIntakeLetterScans),
		db
			.select({ total: countDistinct(modelIntakeSubmissions.letterCode) })
			.from(modelIntakeSubmissions)
	])
	return {
		posted: posted?.total ?? 0,
		scanned: scanned?.total ?? 0,
		replied: replied?.total ?? 0
	}
}

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
			letterCode: modelIntakeSubmissions.letterCode,
			letterOrganization: modelIntakeLetters.organization,
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
		.leftJoin(
			modelIntakeLetters,
			eq(modelIntakeSubmissions.letterCode, modelIntakeLetters.code)
		)
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
			referenceCode: modelIntakeSubmissions.referenceCode,
			photoPaths: modelIntakeSubmissions.photoPaths
		})
		.from(modelIntakeSubmissions)
		.where(lte(modelIntakeSubmissions.deleteAfter, now))
}

/**
 * A letter registered longer ago than the retention period that no request
 * kept past `now` names. A request keeps its letter for as long as the request
 * is kept, a booked pilot's included; a request due at `now` does not, so the
 * letter goes in the same purge. Its scans go with it (`on delete cascade`).
 */
function isExpiredIntakeLetter(now: Date) {
	const registeredBefore = new Date(
		now.getTime() - MODEL_INTAKE_RETENTION_DAYS * 86_400_000
	)
	const keptRequest = getDbClient()
		.select({ id: modelIntakeSubmissions.id })
		.from(modelIntakeSubmissions)
		.where(
			and(
				eq(modelIntakeSubmissions.letterCode, modelIntakeLetters.code),
				or(
					isNull(modelIntakeSubmissions.deleteAfter),
					gt(modelIntakeSubmissions.deleteAfter, now)
				)
			)
		)
	return and(
		lte(modelIntakeLetters.createdAt, registeredBefore),
		notExists(keptRequest)
	)
}

export async function selectExpiredIntakeLetters(now: Date) {
	return getDbClient()
		.select({ code: modelIntakeLetters.code })
		.from(modelIntakeLetters)
		.where(isExpiredIntakeLetter(now))
}

/**
 * Deletes by the rule rather than by a list read earlier, so a request that
 * names a letter while the purge runs keeps it.
 */
export async function deleteExpiredIntakeLetters(now: Date) {
	return getDbClient()
		.delete(modelIntakeLetters)
		.where(isExpiredIntakeLetter(now))
		.returning({ code: modelIntakeLetters.code })
}

export async function deleteIntakeRow(id: string): Promise<void> {
	await getDbClient()
		.delete(modelIntakeSubmissions)
		.where(eq(modelIntakeSubmissions.id, id))
}
