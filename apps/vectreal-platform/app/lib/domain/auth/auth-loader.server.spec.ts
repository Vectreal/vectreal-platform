import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadAuthenticatedUser } from './auth-loader.server'

const { getAuthUser, initializeUserDefaults, reportServerError } = vi.hoisted(
	() => ({
		getAuthUser: vi.fn(),
		initializeUserDefaults: vi.fn(),
		reportServerError: vi.fn()
	})
)

vi.mock('../../http/auth.server', () => ({ getAuthUser }))
vi.mock('../user/user-repository.server', () => ({ initializeUserDefaults }))
vi.mock('../../observability/report-server-error.server', () => ({
	reportServerError
}))
vi.mock('../../supabase.server', () => ({ createSupabaseClient: vi.fn() }))

const request = new Request('https://vectreal.com/dashboard')

beforeEach(() => {
	getAuthUser.mockReset().mockResolvedValue({ user: { id: 'user-1' } })
	initializeUserDefaults.mockReset()
	reportServerError.mockReset()
})

describe('loadAuthenticatedUser', () => {
	it('reports a failed initialization and answers 500 without its text', async () => {
		const failure = new Error('duplicate key value violates "users_pkey"')
		initializeUserDefaults.mockRejectedValue(failure)

		const thrown = await loadAuthenticatedUser(request).then(
			() => null,
			(error: unknown) => error
		)

		expect(thrown).toBeInstanceOf(Response)
		const response = thrown as Response
		expect(response.status).toBe(500)
		// Every dashboard boundary shows a string body as its description.
		expect(await response.text()).toBe('')
		expect(reportServerError).toHaveBeenCalledWith(failure, { request })
	})
})
