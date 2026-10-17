import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CLI_OAUTH_CLIENT_NAME, findCliClient } from './agent-cli-client.server'

const listClients = vi.hoisted(() => vi.fn())

vi.mock('../../supabase.server', () => ({
	createSupabaseAdminClient: () => ({
		auth: { admin: { oauth: { listClients } } }
	})
}))

const cli = {
	client_id: 'cli-id',
	client_name: CLI_OAUTH_CLIENT_NAME,
	redirect_uris: ['http://127.0.0.1:51730/callback']
}

beforeEach(() => {
	listClients.mockReset()
})

describe('findCliClient', () => {
	it('finds the client registered under the CLI name', async () => {
		listClients.mockResolvedValue({
			data: {
				clients: [
					{ ...cli, client_id: 'other', client_name: 'Vectreal CLI (test)' },
					cli
				]
			},
			error: null
		})

		await expect(findCliClient()).resolves.toEqual({
			clientId: 'cli-id',
			redirectUris: ['http://127.0.0.1:51730/callback']
		})
	})

	it('is null when no client carries the name', async () => {
		listClients.mockResolvedValue({
			data: { clients: [{ ...cli, client_name: 'Something else' }] },
			error: null
		})

		await expect(findCliClient()).resolves.toBeNull()
	})

	it('fails rather than reporting no client when the lookup fails', async () => {
		listClients.mockResolvedValue({
			data: { clients: [] },
			error: new Error('Auth unavailable')
		})

		await expect(findCliClient()).rejects.toThrow('Auth unavailable')
	})
})
