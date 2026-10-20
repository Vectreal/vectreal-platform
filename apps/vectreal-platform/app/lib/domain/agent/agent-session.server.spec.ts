import { beforeEach, describe, expect, it, vi } from 'vitest'

import { endAgentSession } from './agent-session.server'

const signOut = vi.hoisted(() => vi.fn())

vi.mock('../../supabase.server', () => ({
	createSupabaseAdminClient: () => ({ auth: { admin: { signOut } } })
}))

const request = new Request('https://vectreal.com/api/v1/session', {
	method: 'DELETE',
	headers: { Authorization: 'Bearer the-token' }
})

beforeEach(() => {
	signOut.mockReset().mockResolvedValue({ data: null, error: null })
})

describe('endAgentSession', () => {
	it('ends only the session behind the bearer token', async () => {
		await endAgentSession(request)

		expect(signOut).toHaveBeenCalledWith('the-token', 'local')
	})

	it('fails rather than reporting a session ended that Auth kept', async () => {
		const failure = new Error('Auth unavailable')
		signOut.mockResolvedValue({ data: null, error: failure })

		await expect(endAgentSession(request)).rejects.toBe(failure)
	})
})
