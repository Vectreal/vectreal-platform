/**
 * Shaping API keys for the embed panel's key picker.
 *
 * Pure - no database import and no `.server` suffix - so the rules below are
 * testable directly rather than only through a route, and so the client can
 * import the option type without pulling the db client in.
 */

/** One row in the embed panel's key picker. Never carries a key's plaintext. */
export interface EmbedApiKeyOption {
	id: string
	name: string
	/** Last four characters of the key. The only part ever stored in the clear. */
	keyPreview: string
	expiresAt: string | null
	lastUsedAt: string | null
	revoked: boolean
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
		.map((key) => ({
			id: key.apiKey.id,
			name: key.apiKey.name,
			keyPreview: key.apiKey.keyPreview,
			expiresAt: key.apiKey.expiresAt?.toISOString() ?? null,
			lastUsedAt: key.apiKey.lastUsedAt?.toISOString() ?? null,
			revoked: key.apiKey.revokedAt !== null || key.apiKey.active === false,
			expired:
				key.apiKey.expiresAt !== null &&
				key.apiKey.expiresAt.getTime() <= now.getTime(),
			createdAt: key.apiKey.createdAt.getTime()
		}))
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
