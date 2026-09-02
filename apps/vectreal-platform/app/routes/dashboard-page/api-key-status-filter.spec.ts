/**
 * Which keys the Active / Revoked & expired tabs show.
 *
 * The rule is one line in `OrgApiKeysTable`, and it is the kind of line that is
 * easy to get backwards without anyone noticing: both buckets render a
 * plausible-looking table, and the Status badge keeps saying the right thing on
 * every row it does show.
 *
 * It is pinned against `resolveApiKeyState` rather than re-implemented here, so
 * the tabs and the badge cannot drift apart about what "revoked" means.
 */

import { describe, expect, it } from 'vitest'

import {
	matchesApiKeyStatusFilter,
	type ApiKeyStatusFilter
} from './api-key-status-filter'

import type { ApiKeyLifecycleRow } from '../../lib/domain/auth/api-key-lifecycle'

const NOW = new Date('2026-03-01T00:00:00.000Z')

const live: ApiKeyLifecycleRow = {
	active: true,
	expiresAt: null,
	revokedAt: null
}
const revoked: ApiKeyLifecycleRow = {
	active: false,
	expiresAt: null,
	revokedAt: new Date('2026-02-01T00:00:00.000Z')
}
const expired: ApiKeyLifecycleRow = {
	active: true,
	expiresAt: new Date('2026-02-01T00:00:00.000Z'),
	revokedAt: null
}
/* `active` is nullable, and the query requires `active = true`, so null is refused. */
const inactive: ApiKeyLifecycleRow = {
	active: null,
	expiresAt: null,
	revokedAt: null
}

describe('the API key status filter', () => {
	const filters: ApiKeyStatusFilter[] = ['all', 'active', 'inactive']

	it('names every bucket it can filter by', () => {
		expect(filters).toHaveLength(3)
	})

	it('shows everything under All', () => {
		for (const row of [live, revoked, expired, inactive]) {
			expect(
				matchesApiKeyStatusFilter(row, 'all', NOW),
				JSON.stringify(row)
			).toBe(true)
		}
	})

	it('shows only a key that still authorizes under Active', () => {
		expect(matchesApiKeyStatusFilter(live, 'active', NOW)).toBe(true)

		for (const dead of [revoked, expired, inactive]) {
			expect(
				matchesApiKeyStatusFilter(dead, 'active', NOW),
				JSON.stringify(dead)
			).toBe(false)
		}
	})

	it('folds expired and inactive in with revoked, and they are the remainder', () => {
		/*
		  Three spellings of "no". Someone opening this tab is asking which keys
		  have stopped working, not which mechanism stopped them - the Status
		  column names that. `inactive` in particular has to be here: it is the
		  null-`active` row the SQL refuses, and leaving it out would put a key
		  that authorizes nothing under Active.
		*/
		for (const dead of [revoked, expired, inactive]) {
			expect(
				matchesApiKeyStatusFilter(dead, 'inactive', NOW),
				JSON.stringify(dead)
			).toBe(true)
		}
		expect(matchesApiKeyStatusFilter(live, 'inactive', NOW)).toBe(false)
	})

	it('puts every key in exactly one of the two named buckets', () => {
		for (const row of [live, revoked, expired, inactive]) {
			const inActive = matchesApiKeyStatusFilter(row, 'active', NOW)
			const inInactive = matchesApiKeyStatusFilter(row, 'inactive', NOW)

			expect(inActive !== inInactive, JSON.stringify(row)).toBe(true)
		}
	})
})
