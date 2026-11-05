/**
 * What the daily free-model purge removes, against real rows.
 *
 * A request goes once past its `deleteAfter`. A letter is due 90 days after it
 * was registered, unless a request kept past the run still names it. That rule
 * lives in one subquery, so only a real database shows that it holds: a letter
 * dropped too early takes the organization off a booked pilot's request, and
 * one never dropped breaks the promise on /free-model.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * The purge runs at a `now` in the year 2000, so the only rows due at it are
 * the ones made here, and every row it creates is dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Deletion =
	typeof import('../../app/lib/domain/model-intake/model-intake-deletion.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

const DAY_MS = 86_400_000

describe('the free-model purge', () => {
	// Loaded in `beforeAll`: these modules call `getDbClient()` on import.
	let schema: Schema
	let deletion: Deletion
	let db: Db

	const now = new Date('2000-01-01T00:00:00Z')
	const daysFromNow = (days: number) => new Date(now.getTime() + days * DAY_MS)
	const tag = randomUUID().slice(0, 8)
	const code = (name: string) => `${name}-${tag}`

	const letters = {
		unanswered: code('unanswered'),
		recent: code('recent'),
		pilot: code('pilot'),
		replyDue: code('reply-due'),
		replyKept: code('reply-kept'),
		oneDueOneKept: code('one-due-one-kept')
	}

	const request = (letterCode: string, deleteAfter: Date | null) => ({
		referenceCode: `VCTR-${randomUUID().slice(0, 8)}`,
		locale: 'en',
		batch: 'test',
		letterCode,
		productType: 'furniture',
		name: 'x',
		email: 'x',
		company: 'x',
		photoPaths: [],
		consentVersion: 'test',
		consentFollowUpAt: now,
		consentPhotosAt: now,
		deleteAfter
	})

	const requests = {
		pilot: request(letters.pilot, null),
		replyDue: request(letters.replyDue, daysFromNow(-1)),
		replyKept: request(letters.replyKept, daysFromNow(1)),
		mixedDue: request(letters.oneDueOneKept, daysFromNow(-1)),
		mixedKept: request(letters.oneDueOneKept, daysFromNow(1))
	}

	const mine = new Set([
		...Object.values(letters),
		...Object.values(requests).map((row) => row.referenceCode)
	])
	const ours = <T>(rows: T[], key: (row: T) => string) =>
		rows
			.map(key)
			.filter((value) => mine.has(value))
			.sort()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		deletion =
			await import('../../app/lib/domain/model-intake/model-intake-deletion.server')
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.modelIntakeLetters).values(
			Object.entries(letters).map(([name, letterCode]) => ({
				code: letterCode,
				organization: `smoke-${name}`,
				category: 'furniture',
				locale: 'en',
				createdAt: daysFromNow(name === 'recent' ? -89 : -91)
			}))
		)
		await db
			.insert(schema.modelIntakeLetterScans)
			.values([{ letterCode: letters.unanswered, scannedAt: daysFromNow(-91) }])
		await db
			.insert(schema.modelIntakeSubmissions)
			.values(Object.values(requests))
	})

	afterAll(async () => {
		const codes = Object.values(letters)
		await db
			.delete(schema.modelIntakeSubmissions)
			.where(inArray(schema.modelIntakeSubmissions.letterCode, codes))
		await db
			.delete(schema.modelIntakeLetters)
			.where(inArray(schema.modelIntakeLetters.code, codes))
	})

	const dueRequests = [
		requests.replyDue.referenceCode,
		requests.mixedDue.referenceCode
	].sort()
	const dueLetters = [letters.replyDue, letters.unanswered].sort()

	it('names due requests, and old letters no kept request still needs', async () => {
		const due = await deletion.selectPurge(now)

		expect(ours(due.requests, (row) => row.referenceCode)).toEqual(dueRequests)
		expect(ours(due.letters, (letter) => letter.code)).toEqual(dueLetters)
	})

	it('deletes exactly what it named, scans with their letter', async () => {
		const purged = await deletion.purgeExpiredIntakes(now)

		expect(ours(purged.requests, (row) => row.referenceCode)).toEqual(
			dueRequests
		)
		expect(ours(purged.letters, (letter) => letter.code)).toEqual(dueLetters)

		const remainingLetters = await db
			.select({ code: schema.modelIntakeLetters.code })
			.from(schema.modelIntakeLetters)
			.where(inArray(schema.modelIntakeLetters.code, Object.values(letters)))
		expect(remainingLetters.map((row) => row.code).sort()).toEqual(
			[
				letters.recent,
				letters.pilot,
				letters.replyKept,
				letters.oneDueOneKept
			].sort()
		)

		const remainingRequests = await db
			.select({
				referenceCode: schema.modelIntakeSubmissions.referenceCode,
				letterCode: schema.modelIntakeSubmissions.letterCode
			})
			.from(schema.modelIntakeSubmissions)
			.where(
				inArray(
					schema.modelIntakeSubmissions.referenceCode,
					Object.values(requests).map((row) => row.referenceCode)
				)
			)
		expect(remainingRequests).toHaveLength(3)
		expect(remainingRequests.every((row) => row.letterCode !== null)).toBe(true)

		const scans = await db
			.select()
			.from(schema.modelIntakeLetterScans)
			.where(
				inArray(schema.modelIntakeLetterScans.letterCode, [letters.unanswered])
			)
		expect(scans).toEqual([])
	})
})
