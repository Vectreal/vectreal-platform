import { apiFailureSchema, apiSuccessSchema, cliClientSchema } from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loader } from './cli-client'

const findCliClient = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/domain/agent/agent-cli-client.server', () => ({
	findCliClient
}))

beforeEach(() => {
	vi.stubEnv('SUPABASE_URL', 'https://api.vectreal.com')
	findCliClient.mockReset()
})

describe('GET /api/v1/cli/client', () => {
	it('tells the CLI its client, redirect URIs and authorization server', async () => {
		findCliClient.mockResolvedValue({
			clientId: 'cli-id',
			redirectUris: ['http://127.0.0.1:51730/callback']
		})

		const response = await loader()

		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
		const body = await response.json()
		expect(body).toEqual({
			success: true,
			data: {
				client_id: 'cli-id',
				redirect_uris: ['http://127.0.0.1:51730/callback'],
				authorization_server: 'https://api.vectreal.com/auth/v1'
			}
		})
		// The SDK the CLI ships with reads exactly what went over the wire.
		expect(apiSuccessSchema(cliClientSchema).parse(body)).toEqual(body)
	})

	it('answers 404 where no CLI client is registered', async () => {
		findCliClient.mockResolvedValue(null)

		const response = await loader()

		expect(response.status).toBe(404)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		// A refusal the SDK reads as one, not as a body it cannot understand.
		expect(apiFailureSchema.parse(await response.json()).code).toBe('not_found')
	})
})
