/**
 * Which free-model letters the daily purge removes, against real rows.
 *
 * A letter is due 90 days after it was registered, unless a request kept past
 * the run still names it. The rule lives in one join, so only a real database
 * shows that it holds: a letter dropped too early takes the organization off a
 * booked pilot's request, and one never dropped breaks the promise on
 * /free-model.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * Every row it creates is namespaced by a fresh uuid and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Repo =
	typeof import('../../app/lib/domain/model-intake/model-intake-repository.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

const DAY_MS = 86_400_000

describe('the free-model letter purge', () => {
	// Loaded in `beforeAll`: these modules call `getDbClient()` on import.
	let schema: Schema
	let repo: Repo
	let db: Db

	const now = new Date()
	const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS)
	const tag = randomUUID().slice(0, 8)
	const code = (name: string) => `${name}-${tag}`

	const letters = {
		unanswered: code('unanswered'),
		recent: code('recent'),
		pilot: code('pilot'),
		replyDue: code('reply-due'),
		replyKept: code('reply-kept')
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

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		repo =
			await import('../../app/lib/domain/model-intake/model-intake-repository.server')
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.modelIntakeLetters).values(
			Object.entries(letters).map(([name, letterCode]) => ({
				code: letterCode,
				organization: `smoke-${name}`,
				category: 'furniture',
				locale: 'en',
				createdAt: name === 'recent' ? daysAgo(89) : daysAgo(91)
			}))
		)
		await db
			.insert(schema.modelIntakeLetterScans)
			.values([{ letterCode: letters.unanswered, scannedAt: daysAgo(91) }])
		await db
			.insert(schema.modelIntakeSubmissions)
			.values([
				request(letters.pilot, null),
				request(letters.replyDue, daysAgo(1)),
				request(letters.replyKept, new Date(now.getTime() + DAY_MS))
			])
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

	const due = async () =>
		(await repo.selectExpiredIntakeLetters(now))
			.map((letter) => letter.code)
			.filter((letterCode) => letterCode.endsWith(tag))
			.sort()

	it('names old letters no kept request still needs, and only those', async () => {
		expect(await due()).toEqual([letters.replyDue, letters.unanswered].sort())
	})

	it('removes a due letter together with its scans', async () => {
		await repo.deleteIntakeLetters([letters.unanswered])

		const scans = await db
			.select()
			.from(schema.modelIntakeLetterScans)
			.where(
				inArray(schema.modelIntakeLetterScans.letterCode, [letters.unanswered])
			)
		expect(scans).toEqual([])
		expect(await due()).toEqual([letters.replyDue])
	})
})
