/**
 * Registering letters against real rows: a reprint of the same letter is
 * accepted, and a code already registered for a different letter is refused
 * before anything is printed, whichever field differs. The comparison is one
 * query, so only a real database shows it covers every field the forward and
 * the form read.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { ModelIntakeLetter } from '../../app/lib/domain/model-intake/model-intake-repository.server'

type Schema = typeof import('../../app/db/schema')
type Repository =
	typeof import('../../app/lib/domain/model-intake/model-intake-repository.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

describe('registering intake letters', () => {
	// Loaded in `beforeAll`: these modules call `getDbClient()` on import.
	let schema: Schema
	let repository: Repository
	let db: Db

	const letter: ModelIntakeLetter = {
		code: `T${randomUUID().slice(0, 7).toUpperCase()}`,
		organization: 'Brand GmbH',
		audience: 'brand',
		category: 'shoes',
		showcase: 'lamp',
		locale: 'de'
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		repository =
			await import('../../app/lib/domain/model-intake/model-intake-repository.server')
		db = (await import('../../app/db/client')).getDbClient()
		await repository.insertIntakeLetters([letter])
	})

	afterAll(async () => {
		await db
			.delete(schema.modelIntakeLetters)
			.where(inArray(schema.modelIntakeLetters.code, [letter.code]))
	})

	it('reads a letter back with its showcase', async () => {
		expect(await repository.findIntakeLetter(letter.code)).toEqual(letter)
	})

	it('accepts a reprint of the same letter', async () => {
		expect(await repository.findConflictingIntakeLetters([letter])).toEqual([])
	})

	it.each([
		['organization', { organization: 'Other GmbH' }],
		['audience', { audience: 'agency' }],
		['category', { category: 'bags' }],
		['showcase', { showcase: 'fire' }],
		['showcase', { showcase: null }],
		['locale', { locale: 'en' }]
	] as const)(
		'refuses the code for a letter with another %s',
		async (_, change) => {
			expect(
				await repository.findConflictingIntakeLetters([
					{ ...letter, ...change }
				])
			).toEqual([letter.code])
		}
	)
})
