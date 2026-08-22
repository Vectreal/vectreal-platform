import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
	isApiKeyLive,
	resolveApiKeyState,
	type ApiKeyLifecycleRow
} from '../app/lib/domain/auth/api-key-lifecycle'

/**
 * The contract between the two halves that decide whether an API key works.
 *
 * `findLiveKeyForProject` decides it in Postgres; `isApiKeyLive` decides it in
 * TypeScript for every surface that cannot run SQL. Testing either one alone
 * proves nothing, because the bug this file exists to prevent is the two of them
 * disagreeing - which they did, in two places, until 2026-08-22.
 *
 * So the SQL predicate is transcribed here as data, the transcription is checked
 * against the real query text, and the module is checked against the
 * transcription over every combination of the three columns involved.
 */

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUTH_MODULE = join(
	APP_ROOT,
	'app/lib/domain/auth/preview-api-key-auth.server.ts'
)

const authSource = readFileSync(AUTH_MODULE, 'utf8')

/**
 * The lifecycle half of `findLiveKeyForProject`'s `WHERE` clause.
 *
 * `sql` is the literal Drizzle expression, so editing the query without editing
 * this file fails below rather than silently drifting. `holds` is its meaning.
 */
const LIFECYCLE_SQL_CLAUSES: Array<{
	sql: string
	holds: (row: ApiKeyLifecycleRow, now: Date) => boolean
}> = [
	{
		sql: 'eq(apiKeys.active, true)',
		holds: (row) => row.active === true
	},
	{
		sql: 'isNull(apiKeys.revokedAt)',
		holds: (row) => row.revokedAt === null
	},
	{
		sql: 'or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now))',
		holds: (row, now) =>
			row.expiresAt === null || row.expiresAt.getTime() > now.getTime()
	}
]

/** The identity half. Not lifecycle, but it has to be accounted for below. */
const IDENTITY_SQL_CLAUSES = [
	'eq(apiKeys.hashedKey, hashedToken)',
	'eq(apiKeyProjects.projectId, projectId)'
]

function extractWhereClause(source: string): string {
	/*
	  Anchored on the function rather than taking the file's first `.where(`.
	  There is a second one further down, on the `lastUsedAt` update, and adding
	  any query above this one would otherwise make the assertion below fail
	  while pointing at the wrong statement.
	*/
	const fn = source.indexOf('async function findLiveKeyForProject')
	expect(fn, 'findLiveKeyForProject has been renamed or moved').toBeGreaterThan(
		-1
	)

	const start = source.indexOf('.where(', fn)
	const end = source.indexOf('.limit(', start)
	expect(start, 'findLiveKeyForProject no longer has a .where(').toBeGreaterThan(
		-1
	)
	expect(end, 'findLiveKeyForProject no longer has a .limit(').toBeGreaterThan(
		start
	)

	return source.slice(start, end).replace(/\s+/g, '')
}

const NOW = new Date('2026-08-22T12:00:00.000Z')
const PAST = new Date('2026-08-21T12:00:00.000Z')
const FUTURE = new Date('2026-08-23T12:00:00.000Z')
/** The expiry instant itself. The query calls this dead; the table used to call it Active. */
const EXACTLY_NOW = new Date(NOW.getTime())

const ACTIVE_VALUES: Array<boolean | null> = [true, false, null]
const REVOKED_VALUES: Array<Date | null> = [null, PAST]
const EXPIRY_VALUES: Array<Date | null> = [null, PAST, EXACTLY_NOW, FUTURE]

const ALL_ROWS: ApiKeyLifecycleRow[] = ACTIVE_VALUES.flatMap((active) =>
	REVOKED_VALUES.flatMap((revokedAt) =>
		EXPIRY_VALUES.map((expiresAt) => ({ active, expiresAt, revokedAt }))
	)
)

function describeRow(row: ApiKeyLifecycleRow): string {
	const expiry =
		row.expiresAt === null
			? 'no expiry'
			: row.expiresAt.getTime() === NOW.getTime()
				? 'expiring exactly now'
				: row.expiresAt < NOW
					? 'expired'
					: 'expiring later'

	return `active=${String(row.active)}, ${row.revokedAt ? 'revoked' : 'not revoked'}, ${expiry}`
}

describe('api key lifecycle', () => {
	describe('the transcription of the query still matches the query', () => {
		it.each(LIFECYCLE_SQL_CLAUSES.map((clause) => clause.sql))(
			'%s is still in findLiveKeyForProject',
			(sql) => {
				expect(
					authSource.replace(/\s+/g, '').includes(sql.replace(/\s+/g, '')),
					`findLiveKeyForProject no longer contains ${sql}. If the query changed, change LIFECYCLE_SQL_CLAUSES and api-key-lifecycle.ts with it.`
				).toBe(true)
			}
		)

		/*
		  The teeth. The check above passes just as well when a fourth condition
		  has been added to the query and nothing here knows about it, which is
		  exactly how the two halves drifted apart last time.
		*/
		it('has no lifecycle condition the transcription does not cover', () => {
			const expected = `.where(and(${[
				...IDENTITY_SQL_CLAUSES,
				...LIFECYCLE_SQL_CLAUSES.map((clause) => clause.sql)
			].join(',')}))`.replace(/\s+/g, '')

			expect(
				extractWhereClause(authSource),
				'The WHERE clause of findLiveKeyForProject is not the set of conditions this spec transcribes. A condition was added, removed or reordered; api-key-lifecycle.ts has to answer for it.'
			).toBe(expected)
		})
	})

	/*
	  A static pin, not a behavioural test, and deliberately labelled as one.

	  `validatePreviewApiKeyForProject` records `lastUsedAt` with a timestamp
	  captured before its lookup. Keyed on the row id alone, a slow request that
	  authenticated with a since-rotated secret can land that stale timestamp
	  after a rotation cleared the column and a newer request refilled it -
	  dragging `lastUsedAt` back behind `rotatedAt` and making the dashboard
	  report a healthy key as "Unused since rotating".

	  Reproducing that needs three requests interleaved around a rotation in a
	  specific order, which nothing here can arrange deterministically. So this
	  asserts the guard is still in the predicate, which at least fails when
	  someone simplifies it away. It does not prove the runtime behaviour.
	*/
	it('still guards the lastUsedAt write on the secret that authenticated', () => {
		const normalized = authSource.replace(/\s+/g, '')

		expect(
			normalized.includes(
				'.set({lastUsedAt:now}).where(and(eq(apiKeys.id,decision.apiKeyId),eq(apiKeys.hashedKey,hashedToken)))'
			),
			'The lastUsedAt write is no longer predicated on the hash that authenticated the request. A stale write from a superseded key can now overwrite a newer one, which is what "Unused since rotating" reads.'
		).toBe(true)
	})

	describe('isApiKeyLive agrees with the query on every row shape', () => {
		it.each(ALL_ROWS.map((row) => [describeRow(row), row] as const))(
			'%s',
			(_label, row) => {
				const sqlWouldSelect = LIFECYCLE_SQL_CLAUSES.every((clause) =>
					clause.holds(row, NOW)
				)

				expect(isApiKeyLive(row, NOW)).toBe(sqlWouldSelect)
			}
		)
	})

	describe('resolveApiKeyState', () => {
		it('reports revoked ahead of every other reason', () => {
			expect(
				resolveApiKeyState(
					{ active: false, expiresAt: PAST, revokedAt: PAST },
					NOW
				)
			).toBe('revoked')
		})

		it('treats a null active column as inactive, not as usable', () => {
			// The regression: `active === false` let a null-active key through the
			// embed panel's picker, and the query then refused it.
			expect(
				resolveApiKeyState(
					{ active: null, expiresAt: null, revokedAt: null },
					NOW
				)
			).toBe('inactive')
			expect(
				isApiKeyLive({ active: null, expiresAt: null, revokedAt: null }, NOW)
			).toBe(false)
		})

		it('treats the expiry instant itself as expired', () => {
			// The regression: `< now` labelled this Active in the dashboard while
			// the query, using `expires_at > now`, refused it.
			expect(
				resolveApiKeyState(
					{ active: true, expiresAt: EXACTLY_NOW, revokedAt: null },
					NOW
				)
			).toBe('expired')
		})

		it('reports active only when nothing is wrong', () => {
			expect(
				resolveApiKeyState(
					{ active: true, expiresAt: FUTURE, revokedAt: null },
					NOW
				)
			).toBe('active')
			expect(
				resolveApiKeyState(
					{ active: true, expiresAt: null, revokedAt: null },
					NOW
				)
			).toBe('active')
		})
	})
})
