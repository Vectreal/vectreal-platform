import { describe, expect, it } from 'vitest'

import {
	isEmbedKeyUsable,
	toEmbedApiKeyOptions,
	type EmbedApiKeyOption,
	type EmbedApiKeySource
} from '../app/lib/domain/embed/embed-key-options'

const PROJECT_ID = 'project-a'
const NOW = new Date('2026-08-22T12:00:00.000Z')

function makeKey(
	overrides: Partial<EmbedApiKeySource['apiKey']> & { id: string },
	projectIds: string[] = [PROJECT_ID],
	value: string | null = `vctrl_${overrides.id}`
): EmbedApiKeySource {
	return {
		value,
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

	it('carries exactly the fields the picker is allowed to see', () => {
		/*
		  This asserted that nothing beyond the four-character preview ever left
		  the server, which was true while the token existed only as a hash and
		  the panel asked people to paste one back. That is the constraint this
		  change removed: the embed token is published in an `iframe src` on the
		  customer's own page, so withholding it from the owner who minted it
		  bought nothing and cost the whole interaction.

		  The list is still pinned, and still exact, because the reason it was
		  pinned has not changed - an option is serialized to the client, so a
		  field added here is a field published. `value` is on it deliberately;
		  anything else appearing is not.
		*/
		const [option] = toEmbedApiKeyOptions([makeKey({ id: 'k' })], PROJECT_ID, NOW)

		expect(Object.keys(option).sort()).toEqual([
			'expired',
			'expiresAt',
			'id',
			'keyPreview',
			'lastUsedAt',
			'name',
			'revoked',
			'value'
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

describe('isEmbedKeyUsable', () => {
	/*
	  The rule the picker disables a row with, the panel auto-selects by, and
	  `toEmbedApiKeyOptions` sorts on - one function, so "first in the list" and
	  "selectable" cannot drift apart.

	  It replaced `matchesKeyPreview`, which compared a pasted token against the
	  last four characters of the selected key. That comparison only ever existed
	  because the key could not be read back, and there is nothing left to paste.
	*/
	const row = (overrides: Partial<EmbedApiKeyOption>): EmbedApiKeyOption => ({
		id: 'k',
		name: 'Embed key',
		keyPreview: 'ab3x',
		value: 'vctrl_realkeyab3x',
		expiresAt: null,
		lastUsedAt: null,
		revoked: false,
		expired: false,
		...overrides
	})

	it('accepts a live key with a recoverable value', () => {
		expect(isEmbedKeyUsable(row({}))).toBe(true)
	})

	it('refuses an expired key even though its value reads back', () => {
		/*
		  The case that cannot be inferred from `value`: expiry never clears the
		  ciphertext, so the key decrypts, looks selectable, and 404s at the embed
		  because `isApiKeyLive` refuses it.
		*/
		expect(isEmbedKeyUsable(row({ expired: true }))).toBe(false)
	})

	it('refuses a revoked key and a key whose value cannot be read', () => {
		expect(isEmbedKeyUsable(row({ revoked: true, value: null }))).toBe(false)
		expect(isEmbedKeyUsable(row({ value: null }))).toBe(false)
	})
})

describe('a key with no recoverable value', () => {
	/*
	  Rows written before the token was stored decryptably, and rows whose stored
	  value no longer decrypts. They are still live keys and still explain an
	  embed that is failing, so they stay in the list - but they cannot build a
	  snippet, so they must not sit at the top of it as the obvious choice.
	*/
	it('carries the value through when there is one', () => {
		const [option] = toEmbedApiKeyOptions(
			[makeKey({ id: 'k' }, [PROJECT_ID], 'vctrl_realvalue')],
			PROJECT_ID,
			NOW
		)

		expect(option.value).toBe('vctrl_realvalue')
	})

	it('reports null rather than inventing one', () => {
		const [option] = toEmbedApiKeyOptions(
			[makeKey({ id: 'k' }, [PROJECT_ID], null)],
			PROJECT_ID,
			NOW
		)

		expect(option.value).toBeNull()
	})

	it('sorts below a usable key of the same age', () => {
		const options = toEmbedApiKeyOptions(
			[
				makeKey({ id: 'legacy' }, [PROJECT_ID], null),
				makeKey({ id: 'usable' }, [PROJECT_ID], 'vctrl_usable')
			],
			PROJECT_ID,
			NOW
		)

		expect(options.map((option) => option.id)).toEqual(['usable', 'legacy'])
	})
})
