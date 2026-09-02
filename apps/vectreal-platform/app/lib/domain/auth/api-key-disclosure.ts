/**
 * Whether a key of this kind may be handed back to its owner at all.
 *
 * Pure, and separate from the decrypting: the question "may we show this" is
 * about what the key is *for*, and the question "can we still read it" is about
 * what happened to the row. Folding them together is what produced a single
 * null with four different meanings.
 *
 * Every key today is an embed token - published by design into an `iframe src`
 * on a customer's page, restricted by the allowed-domain list rather than by
 * secrecy - so `embed` is disclosable and the map has one entry. The map exists
 * for the second entry, not the first.
 */

import type { apiKeyKindEnum } from '../../../db/schema/auth/api-keys'

export type ApiKeyKind = (typeof apiKeyKindEnum.enumValues)[number]

/**
 * Which kinds may be read back, as a total `Record`.
 *
 * A map rather than an `if`, following `DASHBOARD_OPERATION_ROLES`: adding a
 * value to `apiKeyKindEnum` makes this fail to compile until someone writes the
 * rule for it. An `if` would let a new kind inherit whichever branch it fell
 * into, and for a write-scoped key that branch is the one that hands out the
 * secret.
 *
 * That is the whole point of the column. Without it the default for a
 * server-side key with write scope is whatever the reveal path happens to do,
 * and nothing would force the person adding it to notice.
 */
export const KIND_IS_DISCLOSABLE: Record<ApiKeyKind, boolean> = {
	embed: true
}

export function isApiKeyKindDisclosable(kind: ApiKeyKind): boolean {
	return KIND_IS_DISCLOSABLE[kind]
}
