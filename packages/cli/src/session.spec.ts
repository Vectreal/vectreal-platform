import { afterEach, describe, expect, it } from 'vitest'

import { loadSession, saveSession, type StoredSession } from './credentials'
import { NotSignedInError } from './errors'
import { createTokenSource, REFRESH_MARGIN_MS } from './session'
import {
	fakeAuthorizationServer,
	memoryStore,
	type FakeAuthorizationServer
} from './test-support'

const ORIGIN = 'http://localhost:4200'
const NOW = 1_800_000_000_000

let auth: FakeAuthorizationServer
afterEach(() => auth?.close())

async function setup(expiresIn: number) {
	auth = await fakeAuthorizationServer()
	const store = memoryStore()
	const session: StoredSession = {
		clientId: 'cli-client',
		authorizationServer: auth.url,
		accessToken: 'access-0',
		refreshToken: 'refresh-0',
		expiresAt: NOW + expiresIn
	}
	saveSession(store, ORIGIN, session)
	const getAccessToken = createTokenSource({
		store,
		origin: ORIGIN,
		now: () => NOW
	})
	return { store, getAccessToken }
}

describe('createTokenSource', () => {
	it('returns a token that is not about to lapse, without refreshing', async () => {
		const { getAccessToken } = await setup(REFRESH_MARGIN_MS + 1000)

		expect(await getAccessToken()).toBe('access-0')
		expect(auth.tokenRequests).toHaveLength(0)
	})

	it('refreshes a token inside the margin and keeps the rotated pair', async () => {
		const { store, getAccessToken } = await setup(REFRESH_MARGIN_MS - 1000)

		expect(await getAccessToken()).toBe('access-1')
		expect(Object.fromEntries(auth.tokenRequests[0])).toEqual({
			grant_type: 'refresh_token',
			client_id: 'cli-client',
			refresh_token: 'refresh-0'
		})
		expect(loadSession(store, ORIGIN)).toMatchObject({
			accessToken: 'access-1',
			refreshToken: 'refresh-1'
		})
	})

	it('forgets a session whose refresh is refused, and says to sign in', async () => {
		const { store, getAccessToken } = await setup(-1000)
		auth.answers = [
			{
				status: 400,
				body: {
					error: 'invalid_grant',
					error_description: 'Refresh Token Not Found'
				}
			}
		]

		await expect(getAccessToken()).rejects.toBeInstanceOf(NotSignedInError)
		expect(loadSession(store, ORIGIN)).toBeNull()
	})

	it.each([503, 429, 403])(
		'keeps the session when the refresh answers %i, which says nothing about the grant',
		async (status) => {
			const { store, getAccessToken } = await setup(-1000)
			auth.answers = [{ status, body: { error: 'not now' } }]

			await expect(getAccessToken()).rejects.toThrow('Could not refresh')
			expect(loadSession(store, ORIGIN)?.refreshToken).toBe('refresh-0')
		}
	)

	it('says to sign in when there is no session', async () => {
		auth = await fakeAuthorizationServer()
		const getAccessToken = createTokenSource({
			store: memoryStore(),
			origin: ORIGIN
		})
		await expect(getAccessToken()).rejects.toBeInstanceOf(NotSignedInError)
	})
})
