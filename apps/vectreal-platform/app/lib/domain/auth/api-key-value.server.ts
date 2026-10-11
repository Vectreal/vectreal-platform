/**
 * The one place a stored API key's value is decrypted for its owner.
 *
 * Two surfaces read a key back - the dashboard's API keys page and the embed
 * panel's `/api/projects/:projectId/api-keys` route - and each used to call
 * `decryptEmbedToken` itself. Only the dashboard asked `isApiKeyKindDisclosable`
 * first, so the day a write-scoped kind was added, the embed route would have
 * handed its plaintext to the panel. Routing both through here means the kind
 * gate cannot be skipped by a caller that only wanted the value.
 *
 * Who may read keys at all is not decided here: each route checks
 * `api-key:read` before it calls this.
 */

import {
	isApiKeyKindDisclosable,
	type ApiKeyRowValue
} from './api-key-disclosure'
import {
	resolveApiKeyState,
	type ApiKeyLifecycleRow
} from './api-key-lifecycle'
import { decryptEmbedToken } from '../../security/embed-token-cipher.server'

import type { ApiKeyKind } from './api-key-disclosure'

/** The minimum of an `api_keys` row this module reads. */
export interface ApiKeyValueRow extends ApiKeyLifecycleRow {
	kind: ApiKeyKind
	encryptedKey: string | null
}

/**
 * Whether this key's value can be put in front of its owner, and if not, why.
 *
 * The embed token is public by construction - `buildEmbedUrl` puts it in an
 * `iframe src` on the customer's own page - so the question this answers is
 * "can it be read back", not "may it be seen". `encrypted_key` exists for
 * exactly this.
 *
 * `revoked` is read first, and not as a synonym for a null ciphertext.
 * `revokeApiKey` clears the ciphertext on purpose, so both branches would fire
 * for a revoked row - and `never-stored` tells its owner to rotate, which
 * `rotateApiKey` refuses for anything that is not active. Wrong order is a
 * wrong instruction, not a cosmetic slip.
 *
 * Expired and inactive keys still return their value. This is not asking
 * whether the key works; `resolveApiKeyState` answers that for the dashboard's
 * Status column and the embed picker's flags. An expired key's value is still
 * what identifies it in a page that has started 404ing.
 */
export function resolveApiKeyValue(
	row: ApiKeyValueRow,
	now: Date
): ApiKeyRowValue {
	/*
	  Asked before anything is decrypted, because it is a different question from
	  the three below it: those are reasons a value cannot be produced, this is a
	  reason it must not be. Today it never fires - every row is an `embed` key -
	  and it exists so that the day a write-scoped kind is added, showing it is a
	  decision someone has to make rather than the default.
	*/
	if (!isApiKeyKindDisclosable(row.kind)) {
		return { readable: false, reason: 'withheld' }
	}

	if (resolveApiKeyState(row, now) === 'revoked') {
		return { readable: false, reason: 'revoked' }
	}

	if (row.encryptedKey === null) {
		return { readable: false, reason: 'never-stored' }
	}

	/*
	  `decryptEmbedToken` returns null for a ciphertext that no longer
	  authenticates as well as for one that was never there, and this is the only
	  place the two are still separable - the branch above has already taken the
	  second case. Past this point they would be one indistinguishable null.
	*/
	const value = decryptEmbedToken(row.encryptedKey)

	return value === null
		? { readable: false, reason: 'undecryptable' }
		: { readable: true, value }
}
