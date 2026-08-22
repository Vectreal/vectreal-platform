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

/** One row in the embed panel's key picker. Never carries a key's plaintext. */
export interface EmbedApiKeyOption {
	id: string
	name: string
	/** Last four characters of the key. The only part ever stored in the clear. */
	keyPreview: string
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

/** Minimum of `ApiKeyWithDetails` this module reads. */
export interface EmbedApiKeySource {
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
			const byUsable =
				Number(a.revoked || a.expired) - Number(b.revoked || b.expired)
			return byUsable !== 0 ? byUsable : b.createdAt - a.createdAt
		})
		.map(({ createdAt: _createdAt, ...option }) => option)
}

/**
 * Whether a pasted token could be the selected key.
 *
 * Only the last four characters are stored in the clear, so this is the whole
 * check that is available: it catches pasting the wrong key of several, and
 * cannot confirm the right one. Advisory, never a gate - a false negative here
 * must not stop someone shipping a key that works.
 */
export function matchesKeyPreview(token: string, keyPreview: string): boolean {
	const trimmed = token.trim()
	if (trimmed.length < keyPreview.length) {
		return false
	}

	return trimmed.slice(-keyPreview.length) === keyPreview
}
