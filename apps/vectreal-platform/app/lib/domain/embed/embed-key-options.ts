/**
 * Shaping API keys for the embed panel's key picker.
 *
 * Pure - no database import and no `.server` suffix - so the rules below are
 * testable directly rather than only through a route, and so the client can
 * import the option type without pulling the db client in.
 *
 * Whether a key still works is not decided here. `api-key-lifecycle.ts` owns
 * that, and this module only shapes its answer for the picker.
 */

import { resolveApiKeyState } from '../auth/api-key-lifecycle'

/** One row in the embed panel's key picker, value included where there is one. */
export interface EmbedApiKeyOption {
	id: string
	name: string
	/** Last four characters of the key, for naming it without reading it. */
	keyPreview: string
	/**
	 * The key itself, when this row still has a recoverable one.
	 *
	 * Null in three cases, and the third is the routine one: a key created before
	 * the token was stored decryptably, a key whose stored value no longer
	 * decrypts, and a revoked key, whose value `revokeApiKey` clears on purpose.
	 *
	 * Any of them can still be named, and still explains an embed that is
	 * failing, but none can build a snippet. Rotation is the way back for the
	 * first two only - `rotateApiKey` refuses anything that is not active, so a
	 * revoked key is replaced rather than recovered. Read `revoked` before this
	 * field when deciding what to tell someone.
	 *
	 * Decrypted by the route before it reaches this module, which stays free of
	 * any server import so the client can hold this type.
	 */
	value: string | null
	expiresAt: string | null
	lastUsedAt: string | null
	/** Revoked, or otherwise unusable for a reason the owner caused. */
	revoked: boolean
	/**
	 * Aged out, and not revoked.
	 *
	 * Mutually exclusive with `revoked` rather than independent of it: these are
	 * two views of one state, and a revoked key reports only that it was revoked,
	 * which is the fact its owner acted on. Read them in that order, as
	 * `embed-key-field.tsx` does.
	 */
	expired: boolean
}

/** Minimum of `ApiKeyWithDetails` this module reads, plus the decrypted token. */
export interface EmbedApiKeySource {
	/** Already decrypted by the caller; see `EmbedApiKeyOption.value`. */
	value: string | null
	apiKey: {
		id: string
		name: string
		keyPreview: string
		active: boolean | null
		expiresAt: Date | null
		revokedAt: Date | null
		lastUsedAt: Date | null
		createdAt: Date
	}
	projects: Array<{ id: string }>
}

/**
 * The keys scoped to one project, usable ones first.
 *
 * Revoked and expired keys are kept rather than filtered out. They are the
 * answer to the question that brings someone to this panel - an embed that
 * worked yesterday and 404s today usually names a key in its URL that has since
 * been revoked or aged out, and a picker that hides those leaves the owner
 * comparing a working key against an empty list.
 */
export function toEmbedApiKeyOptions(
	keys: EmbedApiKeySource[],
	projectId: string,
	now: Date
): EmbedApiKeyOption[] {
	return keys
		.filter((key) => key.projects.some((project) => project.id === projectId))
		.map((key) => {
			const state = resolveApiKeyState(key.apiKey, now)

			return {
				id: key.apiKey.id,
				name: key.apiKey.name,
				keyPreview: key.apiKey.keyPreview,
				value: key.value,
				expiresAt: key.apiKey.expiresAt?.toISOString() ?? null,
				lastUsedAt: key.apiKey.lastUsedAt?.toISOString() ?? null,
				/*
				  `inactive` counts as revoked here on purpose. The picker's job is to
				  say whether a key still works, and both states mean it does not.
				  This used to ask `active === false`, which let a null-`active` row
				  read as usable in the picker and then 404 at the embed.
				*/
				revoked: state === 'revoked' || state === 'inactive',
				expired: state === 'expired',
				createdAt: key.apiKey.createdAt.getTime()
			}
		})
		.sort((a, b) => {
			/*
			  A key with no recoverable value sorts down with the dead ones. It is
			  live, and it still explains a failing embed, but it cannot produce a
			  snippet - which is what the picker is for, so it must not sit at the
			  top as the obvious choice.

			*/
			const usable = (option: typeof a) =>
				Number(option.revoked || option.expired || option.value === null)

			const byUsable = usable(a) - usable(b)
			return byUsable !== 0 ? byUsable : b.createdAt - a.createdAt
		})
		.map(({ createdAt: _createdAt, ...option }) => option)
}

/**
 * Whether a pasted token could be the selected key.
 *
 * A comparison against the preview, not against the key: it catches pasting the
 * wrong key of several and cannot confirm the right one. Advisory, never a gate
 * - a false negative here must not stop someone shipping a key that works.
 *
 * This was the whole check available while the last four characters were the
 * only part stored in the clear. `EmbedApiKeyOption.value` now carries the key
 * itself where there is one, so a caller holding an option can compare exactly;
 * this remains for the case that has no option to compare against.
 */
export function matchesKeyPreview(token: string, keyPreview: string): boolean {
	const trimmed = token.trim()
	if (trimmed.length < keyPreview.length) {
		return false
	}

	return trimmed.slice(-keyPreview.length) === keyPreview
}
