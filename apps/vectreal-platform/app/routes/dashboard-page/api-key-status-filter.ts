/**
 * Which keys the API Keys table shows.
 *
 * Pure, with no database import and no `.server` suffix, so a spec can pin the
 * rule directly rather than re-stating it - the `scene-route-params.ts` pattern.
 * A copy of this predicate living in the spec would pass whatever the route did
 * with it, which is the failure this file exists to prevent.
 */

import {
	resolveApiKeyState,
	type ApiKeyLifecycleRow
} from '../../lib/domain/auth/api-key-lifecycle'

export type ApiKeyStatusFilter = 'all' | 'active' | 'inactive'

export const STATUS_FILTER_LABELS: Record<ApiKeyStatusFilter, string> = {
	all: 'All',
	active: 'Active',
	inactive: 'Revoked & expired'
}

/**
 * Whether a row belongs in the selected bucket.
 *
 * Decided by `resolveApiKeyState`, so the tabs and the Status badge cannot
 * disagree about what "revoked" means.
 *
 * Two buckets rather than one per state: someone opening this tab is asking
 * which keys have stopped working, not which mechanism stopped them. `inactive`
 * has to fall in with the dead ones in particular - it is the null-`active` row
 * the authorization query refuses, and treating it as live would put a key that
 * authorizes nothing under Active.
 */
export function matchesApiKeyStatusFilter(
	row: ApiKeyLifecycleRow,
	filter: ApiKeyStatusFilter,
	now: Date
): boolean {
	if (filter === 'all') return true

	const state = resolveApiKeyState(row, now)

	return filter === 'active' ? state === 'active' : state !== 'active'
}
