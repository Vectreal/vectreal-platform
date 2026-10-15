import { Ban, CheckCircle2, Clock, XCircle } from 'lucide-react'

import {
	resolveApiKeyState,
	type ApiKeyLifecycleRow,
	type ApiKeyState
} from '../../../lib/domain/auth/api-key-lifecycle'

import type {
	ApiKeyRowValue,
	ApiKeyValueUnavailableReason
} from '../../../lib/domain/auth/api-key-disclosure'

/*
  Owned by the disclosure module, which the server resolves them with; this
  file is where the table, and every import of it, has always read them from.
*/
export type { ApiKeyRowValue, ApiKeyValueUnavailableReason }

export interface ApiKeyRow {
	id: string
	name: string
	description?: string | null
	/**
	 * Last four characters. Still here, and still rendered, because it is what
	 * names a key whose value cannot be read back.
	 */
	keyPreview: string
	/** Resolved server-side; see `ApiKeyRowValue`. */
	value: ApiKeyRowValue
	createdBy: string
	projects: Array<{
		id: string
		name: string
		slug: string
	}>
	lastUsedAt: Date | null
	active: boolean | null
	expiresAt: Date | null
	revokedAt: Date | null
	rotatedAt: Date | null
}

/**
 * How long until a deadline. The one forward-looking phrase on the dashboard.
 *
 * Deliberately not `formatRelativeTime`, which reads backwards and answers
 * "3d ago": feeding it a future date produces a negative that formats as
 * "0 min ago". The two are not the same sentence, which is why the shared
 * owner in `relative-time.tsx` is the past tense only.
 */
export function formatRelativeDeadline(deadline: Date | null): string {
	if (!deadline) return 'soon'

	const days = Math.ceil(
		(new Date(deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
	)

	if (days <= 0) return 'today'
	if (days === 1) return 'tomorrow'

	return `in ${days} days`
}

/**
 * Whether a rotated key has authenticated anything since it was rotated.
 *
 * This is the question that follows every rotation, and the answer is the only
 * way to tell from the dashboard that an embed somewhere is still carrying the
 * old key and being refused right now.
 */
export function isUnusedSinceRotation(row: ApiKeyRow): boolean {
	if (!row.rotatedAt) return false
	if (!row.lastUsedAt) return true

	return new Date(row.lastUsedAt) <= new Date(row.rotatedAt)
}

/**
 * A table row in the shape `api-key-lifecycle` reads.
 *
 * The dates are re-wrapped rather than passed through: loader data reaches this
 * file after serialization, and `RelativeTime` guards the same way at the two
 * cells that render one.
 */
export function toLifecycleRow(row: ApiKeyRow): ApiKeyLifecycleRow {
	return {
		active: row.active,
		expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
		revokedAt: row.revokedAt ? new Date(row.revokedAt) : null
	}
}

/**
 * How each lifecycle state is presented. A total `Record`, so a new state is a
 * compile error here rather than a row that silently renders as Inactive.
 */
const API_KEY_STATUS_PRESENTATION: Record<
	ApiKeyState,
	{
		label: string
		variant: 'default' | 'secondary' | 'destructive' | 'outline'
		Icon: typeof XCircle
	}
> = {
	revoked: { label: 'Revoked', variant: 'destructive', Icon: XCircle },
	expired: { label: 'Expired', variant: 'outline', Icon: Clock },
	active: { label: 'Active', variant: 'default', Icon: CheckCircle2 },
	inactive: { label: 'Inactive', variant: 'secondary', Icon: Ban }
}

export function getApiKeyStatus(row: ApiKeyRow) {
	return API_KEY_STATUS_PRESENTATION[
		resolveApiKeyState(toLifecycleRow(row), new Date())
	]
}

/**
 * Why the value is missing. The cause only - never what to do about it.
 *
 * Declared here rather than imported from `EMBED_COPY`. The dashboard must not
 * depend on the embed domain for its copy - `one-time-key-dialog.tsx` records
 * the same rule - and four short strings is the accepted cost of that.
 *
 * The advice is deliberately not baked in. Two of these causes are fixed by
 * rotating and two are not, but that is not a property of the cause: it is a
 * property of the key's lifecycle state, because `rotateApiKey` refuses
 * anything that is not active. An expired key with no stored value has a
 * recoverable *cause* and no way to act on it, and telling its owner to rotate
 * points at a menu item that is disabled and a server call that throws. See
 * `rotateAdvice` below.
 *
 * `withheld` names no mechanism for the same reason: it is reached both from a
 * role the permission table refuses and from an organization without the
 * entitlement, so naming either one would be wrong half the time.
 */
export const VALUE_UNAVAILABLE_COPY: Record<
	ApiKeyValueUnavailableReason,
	string
> = {
	revoked: 'the value was cleared when this key was revoked',
	'never-stored': 'no value was stored for this key',
	undecryptable: 'the stored value is no longer readable',
	withheld: 'the value is not available for this organization'
}

/**
 * The recoverable causes - the ones a fresh secret would fix.
 *
 * `revoked` is not among them: rotation refuses a revoked key, and its owner
 * replaces it rather than recovering it. `withheld` is not either, because
 * nothing about that row is broken.
 */
const ROTATABLE_REASONS: ReadonlySet<ApiKeyValueUnavailableReason> = new Set([
	'never-stored',
	'undecryptable'
])

/**
 * Whether to tell this row's owner that rotating would give them a value.
 *
 * Both halves are required. The cause has to be one rotation fixes, *and* the
 * key has to still be rotatable - `rotateApiKey` throws for any state but
 * `active`, and the Rotate menu item on this same row is disabled by exactly
 * this predicate.
 */
export function rotateAdvice(
	row: ApiKeyRow,
	reason: ApiKeyValueUnavailableReason
) {
	if (!ROTATABLE_REASONS.has(reason)) return null

	return resolveApiKeyState(toLifecycleRow(row), new Date()) === 'active'
		? 'rotate it to get a value you can copy'
		: null
}
