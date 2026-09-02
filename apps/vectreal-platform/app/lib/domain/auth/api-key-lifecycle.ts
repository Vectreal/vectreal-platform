/**
 * The single source of truth for "is this API key usable, and if not, why".
 *
 * Four places answered that question independently before this module existed,
 * and they disagreed in two ways that reached production:
 *
 *   - `active` is `boolean | null`. The authorization query requires
 *     `active = true`, so a null-`active` row is refused. `toEmbedApiKeyOptions`
 *     asked `active === false`, so the same row was offered in the embed panel's
 *     key picker as usable and then 404'd at the embed.
 *   - The query treats a key as live while `expires_at > now`, so a key at
 *     exactly its expiry instant is dead. `getApiKeyStatus` asked `< now` and
 *     labelled that same key Active in the dashboard table.
 *
 * Neither was visible to a test of either side on its own, which is why
 * `tests/api-key-lifecycle.spec.ts` asserts this module against the query's
 * predicate rather than against itself.
 *
 * Deliberately pure - no database import and no `.server` suffix - so a spec can
 * import it and so components can gate affordances with the same rule the server
 * enforces, following `embed-key-options.ts` and `embed-access-policy.ts`.
 */

export type ApiKeyState = 'active' | 'expired' | 'revoked' | 'inactive'

/** The minimum of an `api_keys` row this module reads. */
export interface ApiKeyLifecycleRow {
	active: boolean | null
	expiresAt: Date | null
	revokedAt: Date | null
}

/**
 * Which state an API key is in.
 *
 * The order is the reporting priority, not a set of independent tests: a revoked
 * key that has also expired reports `revoked`, because that is the fact its
 * owner acted on. Only `active` means the key authorizes anything, so every
 * other branch is a reason a request will be refused.
 */
export function resolveApiKeyState(
	row: ApiKeyLifecycleRow,
	now: Date
): ApiKeyState {
	if (row.revokedAt !== null) {
		return 'revoked'
	}

	// `<=` and not `<`: the query keeps a key live while `expires_at > now`, so
	// the expiry instant itself is already dead.
	if (row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime()) {
		return 'expired'
	}

	// `!== true` and not `=== false`: the column is nullable, and the query
	// requires `active = true`, under which null is refused like false.
	if (row.active !== true) {
		return 'inactive'
	}

	return 'active'
}

/**
 * Whether this key authorizes a request.
 *
 * Equivalent by construction to the `WHERE` clause in `findLiveKeyForProject`
 * (`preview-api-key-auth.server.ts`), which cannot call this function because it
 * runs in Postgres. The spec pins the two together instead.
 */
export function isApiKeyLive(row: ApiKeyLifecycleRow, now: Date): boolean {
	return resolveApiKeyState(row, now) === 'active'
}

/**
 * How long before expiry a key starts warning.
 *
 * Fourteen days because the action it prompts is not instant: rotating refuses
 * the old secret immediately, so the owner has to schedule the swap for when
 * they can update the embedding pages. A warning that arrives the morning it
 * dies is a warning about an outage rather than one that prevents it.
 */
export const EXPIRY_WARNING_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Whether this key still works but is close enough to expiry to say so.
 *
 * Deliberately *not* a member of `ApiKeyState`. That union is pinned against
 * the `WHERE` clause of `findLiveKeyForProject` - `isApiKeyLive` has to agree
 * with what Postgres does, row for row, and `api-key-lifecycle.spec.ts` asserts
 * exactly that. Splitting `active` would break the equivalence by construction,
 * and it would also make `rotateApiKey` refuse the key its owner most needs to
 * rotate, because that guard reads `state !== 'active'`.
 *
 * So this is a second, independent question asked of a key that is already
 * active: not "does it work" but "for how much longer". A key that is revoked,
 * expired, inactive, or has no expiry at all answers false.
 */
export function isApiKeyExpiringSoon(
	row: ApiKeyLifecycleRow,
	now: Date,
	withinMs: number = EXPIRY_WARNING_MS
): boolean {
	if (resolveApiKeyState(row, now) !== 'active') return false
	if (row.expiresAt === null) return false

	return row.expiresAt.getTime() - now.getTime() <= withinMs
}
