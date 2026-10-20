import { loadSession, saveSession, type SecretStore } from './credentials'
import { NotSignedInError } from './errors'
import { RefreshRefusedError, refreshTokens } from './oauth'

/**
 * How long before expiry a token is refreshed. A token checked at the last
 * second can lapse on its way to the server, which then refuses a request the
 * user had every right to make.
 */
export const REFRESH_MARGIN_MS = 60_000

/**
 * The access token for an origin, refreshed first when it is about to lapse.
 * This is what `createVectrealClient({ getAccessToken })` is given.
 *
 * A refused refresh means the grant was revoked or the session ended, so the
 * stored session is deleted and the caller is told to sign in again.
 */
export function createTokenSource({
	store,
	origin,
	now = Date.now,
	fetch: fetchImpl = globalThis.fetch
}: {
	store: SecretStore
	origin: string
	now?: () => number
	fetch?: typeof fetch
}): () => Promise<string> {
	return async () => {
		const session = loadSession(store, origin)
		if (!session) throw new NotSignedInError(origin)
		if (session.expiresAt - now() > REFRESH_MARGIN_MS) {
			return session.accessToken
		}

		try {
			const tokens = await refreshTokens(session, fetchImpl)
			saveSession(store, origin, { ...session, ...tokens })
			return tokens.accessToken
		} catch (error) {
			if (error instanceof RefreshRefusedError) {
				store.delete(origin)
				throw new NotSignedInError(origin)
			}
			throw error
		}
	}
}
