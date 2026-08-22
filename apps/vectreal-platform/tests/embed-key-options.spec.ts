import { describe, expect, it } from 'vitest'

import {
	matchesKeyPreview,
	toEmbedApiKeyOptions,
	type EmbedApiKeySource
} from '../app/lib/domain/embed/embed-key-options'

const PROJECT_ID = 'project-a'
const NOW = new Date('2026-08-22T12:00:00.000Z')

function makeKey(
	overrides: Partial<EmbedApiKeySource['apiKey']> & { id: string },
	projectIds: string[] = [PROJECT_ID]
): EmbedApiKeySource {
	return {
		apiKey: {
			name: `key ${overrides.id}`,
			keyPreview: 'ab3x',
			active: true,
			expiresAt: null,
			revokedAt: null,
			lastUsedAt: null,
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			...overrides
		},
		projects: projectIds.map((id) => ({ id }))
	}
}

describe('toEmbedApiKeyOptions', () => {
	it('keeps only the keys scoped to the project', () => {
		const options = toEmbedApiKeyOptions(
			[
				makeKey({ id: 'mine' }),
				makeKey({ id: 'other' }, ['project-b']),
				makeKey({ id: 'both' }, ['project-b', PROJECT_ID])
			],
			PROJECT_ID,
			NOW
		)

		expect(options.map((option) => option.id)).toEqual(['mine', 'both'])
	})

	it('never carries anything beyond the four-character preview', () => {
		const [option] = toEmbedApiKeyOptions([makeKey({ id: 'k' })], PROJECT_ID, NOW)

		expect(Object.keys(option).sort()).toEqual([
			'expired',
			'expiresAt',
			'id',
			'keyPreview',
			'lastUsedAt',
			'name',
			'revoked'
		])
	})

	it('marks a revoked key by every signal the schema allows', () => {
		const options = toEmbedApiKeyOptions(
			[
				makeKey({ id: 'timestamp', revokedAt: new Date('2026-05-01') }),
				makeKey({ id: 'flag', active: false }),
				/*
				  `active` is nullable, and the embed query requires `active = true`,
				  so a null-`active` key authorizes nothing. This asked
				  `active === false` until 2026-08-22, which offered exactly this key
				  in the picker as usable and then 404'd at the embed.
				*/
				makeKey({ id: 'null-flag', active: null }),
				makeKey({ id: 'live' })
			],
			PROJECT_ID,
			NOW
		)

		const revoked = Object.fromEntries(
			options.map((option) => [option.id, option.revoked])
		)
		expect(revoked).toEqual({
			timestamp: true,
			flag: true,
			'null-flag': true,
			live: false
		})
	})

	it('treats expiry as of the given instant, boundary inclusive', () => {
		const options = toEmbedApiKeyOptions(
			[
				makeKey({ id: 'past', expiresAt: new Date('2026-08-22T11:59:59.000Z') }),
				makeKey({ id: 'exactly', expiresAt: NOW }),
				makeKey({ id: 'future', expiresAt: new Date('2026-08-22T12:00:01.000Z') }),
				makeKey({ id: 'never', expiresAt: null })
			],
			PROJECT_ID,
			NOW
		)

		const expired = Object.fromEntries(
			options.map((option) => [option.id, option.expired])
		)
		expect(expired).toEqual({
			past: true,
			exactly: true,
			future: false,
			never: false
		})
	})

	it('lists usable keys before unusable ones, newest first within each group', () => {
		const options = toEmbedApiKeyOptions(
			[
				makeKey({ id: 'old-usable', createdAt: new Date('2026-01-01') }),
				makeKey({
					id: 'new-revoked',
					createdAt: new Date('2026-08-01'),
					revokedAt: new Date('2026-08-02')
				}),
				makeKey({ id: 'new-usable', createdAt: new Date('2026-07-01') }),
				makeKey({
					id: 'old-expired',
					createdAt: new Date('2025-01-01'),
					expiresAt: new Date('2025-06-01')
				})
			],
			PROJECT_ID,
			NOW
		)

		expect(options.map((option) => option.id)).toEqual([
			'new-usable',
			'old-usable',
			'new-revoked',
			'old-expired'
		])
	})

	it('serializes timestamps so the payload survives the JSON boundary', () => {
		const [option] = toEmbedApiKeyOptions(
			[
				makeKey({
					id: 'k',
					expiresAt: new Date('2026-11-20T00:00:00.000Z'),
					lastUsedAt: new Date('2026-08-01T09:30:00.000Z')
				})
			],
			PROJECT_ID,
			NOW
		)

		expect(option.expiresAt).toBe('2026-11-20T00:00:00.000Z')
		expect(option.lastUsedAt).toBe('2026-08-01T09:30:00.000Z')
	})
})

describe('matchesKeyPreview', () => {
	it('matches on the last four characters, ignoring pasted whitespace', () => {
		expect(matchesKeyPreview('vctrl_longvalueab3x', 'ab3x')).toBe(true)
		expect(matchesKeyPreview('  vctrl_longvalueab3x \n', 'ab3x')).toBe(true)
	})

	it('rejects a different key and a value too short to hold the preview', () => {
		expect(matchesKeyPreview('vctrl_longvalue9zQ1', 'ab3x')).toBe(false)
		expect(matchesKeyPreview('ab', 'ab3x')).toBe(false)
		expect(matchesKeyPreview('', 'ab3x')).toBe(false)
	})

	it('is case sensitive, because the preview is a base62 slice', () => {
		expect(matchesKeyPreview('vctrl_valueAB3X', 'ab3x')).toBe(false)
	})
})
