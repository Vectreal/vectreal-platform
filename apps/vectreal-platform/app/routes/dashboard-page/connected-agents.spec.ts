/**
 * The connected agents route with Supabase, the session and the grant table
 * stubbed: that a revoke reaches Supabase before our row, only ever for the
 * session's own user, and not at all without a valid CSRF token.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => [] as string[])
const oauth = vi.hoisted(() => ({
	listGrants: vi.fn(),
	revokeGrant: vi.fn()
}))
const ensureValidCsrfFormData = vi.hoisted(() => vi.fn())
const deleteAgentGrant = vi.hoisted(() => vi.fn())
const listAgentGrants = vi.hoisted(() => vi.fn())
const reportServerError = vi.hoisted(() => vi.fn())

vi.mock('../../db/client', () => ({ getDbClient: () => ({}) }))
vi.mock('../../lib/http/csrf.server', () => ({ ensureValidCsrfFormData }))
vi.mock('../../lib/observability/report-server-error.server', () => ({
	reportServerError
}))
vi.mock('../../lib/domain/auth/auth-loader.server', () => ({
	loadAuthenticatedUser: vi.fn(async () => ({ user: { id: 'user-1' } }))
}))
vi.mock('../../lib/supabase.server', () => ({
	createSupabaseClient: vi.fn(async () => ({
		client: { auth: { oauth } },
		headers: new Headers()
	}))
}))
vi.mock('../../lib/domain/agent/agent-grant-repository.server', () => ({
	deleteAgentGrant,
	listAgentGrants
}))
vi.mock('../../lib/domain/user/user-repository.server', () => ({
	getUserOrganizations: vi.fn(async () => [{ organization: { id: 'org-1' } }])
}))

import { action, loader } from './connected-agents'

type ActionArgs = Parameters<typeof action>[0]
type LoaderArgs = Parameters<typeof loader>[0]

function revokeRequest(fields: Record<string, string>): ActionArgs {
	const body = new FormData()
	for (const [key, value] of Object.entries(fields)) body.set(key, value)
	return {
		request: new Request('https://vectreal.com/dashboard/connected-agents', {
			method: 'POST',
			body
		}),
		params: {},
		context: {}
	} as unknown as ActionArgs
}

async function run(fields: Record<string, string>) {
	const result = (await action(revokeRequest(fields))) as {
		data: unknown
		init?: { status?: number }
	}
	return result
}

beforeEach(() => {
	calls.length = 0
	ensureValidCsrfFormData.mockReset().mockResolvedValue(null)
	oauth.revokeGrant.mockReset().mockImplementation(async () => {
		calls.push('supabase')
		return { data: {}, error: null }
	})
	deleteAgentGrant.mockReset().mockImplementation(async () => {
		calls.push('grant')
	})
})

describe('revoking a connected agent', () => {
	it('revokes in Supabase first, then deletes the session user’s own row', async () => {
		const result = await run({
			intent: 'revoke',
			clientId: 'cli',
			userId: 'someone-else'
		})

		expect(result.data).toEqual({ success: true, message: 'Agent revoked.' })
		expect(calls).toEqual(['supabase', 'grant'])
		expect(oauth.revokeGrant).toHaveBeenCalledWith({ clientId: 'cli' })
		expect(deleteAgentGrant).toHaveBeenCalledWith('user-1', 'cli')
	})

	it('touches nothing when the CSRF check refuses', async () => {
		const refusal = new Response(null, { status: 403 })
		ensureValidCsrfFormData.mockResolvedValue(refusal)

		await expect(
			action(revokeRequest({ intent: 'revoke', clientId: 'cli' }))
		).resolves.toBe(refusal)
		expect(oauth.revokeGrant).not.toHaveBeenCalled()
		expect(deleteAgentGrant).not.toHaveBeenCalled()
	})

	it('keeps the row when Supabase fails, so the agent still shows', async () => {
		oauth.revokeGrant.mockResolvedValue({
			data: null,
			error: { status: 500, code: 'unexpected_failure' }
		})

		const result = await run({ intent: 'revoke', clientId: 'cli' })

		expect(result.init?.status).toBe(502)
		expect(deleteAgentGrant).not.toHaveBeenCalled()
	})

	it('still deletes the row when Supabase holds no consent to revoke', async () => {
		oauth.revokeGrant.mockResolvedValue({
			data: null,
			error: { status: 404, code: 'oauth_consent_not_found' }
		})

		const result = await run({ intent: 'revoke', clientId: 'cli' })

		expect(result.data).toEqual({ success: true, message: 'Agent revoked.' })
		expect(deleteAgentGrant).toHaveBeenCalledWith('user-1', 'cli')
	})

	it('answers with an error, not the error page, when the row cannot be deleted', async () => {
		const failure = new Error('connection reset')
		deleteAgentGrant.mockRejectedValue(failure)

		const result = await run({ intent: 'revoke', clientId: 'cli' })

		expect(result.init?.status).toBe(500)
		expect(result.data).toEqual({ error: expect.any(String) })
		expect(reportServerError).toHaveBeenCalledWith(
			failure,
			expect.objectContaining({
				properties: { userId: 'user-1', clientId: 'cli' }
			})
		)
	})

	it('refuses a form without a client', async () => {
		const result = await run({ intent: 'revoke' })

		expect(result.init?.status).toBe(400)
		expect(oauth.revokeGrant).not.toHaveBeenCalled()
	})
})

describe('listing connected agents', () => {
	const loaderArgs = {
		request: new Request('https://vectreal.com/dashboard/connected-agents'),
		params: {},
		context: {}
	} as unknown as LoaderArgs

	beforeEach(() => {
		listAgentGrants.mockReset().mockResolvedValue([])
	})

	it('shows no agents on a stack whose OAuth server is off', async () => {
		oauth.listGrants.mockResolvedValue({
			data: null,
			error: { status: 404, code: 'feature_disabled' }
		})

		const result = (await loader(loaderArgs)) as { data: unknown }
		expect(result.data).toEqual({ agents: [] })
	})

	it('fails on any other Supabase error rather than showing an empty list', async () => {
		const error = { status: 500, code: 'unexpected_failure' }
		oauth.listGrants.mockResolvedValue({ data: null, error })

		const thrown = await loader(loaderArgs).then(
			() => null,
			(reason: unknown) => reason
		)
		// A string, which is what the dashboard error boundary shows.
		expect(thrown).toMatchObject({
			data: 'Could not load connected agents.',
			init: { status: 502 }
		})
		expect(
			(thrown as { init: { headers: unknown } }).init.headers
		).toBeInstanceOf(Headers)
		expect(reportServerError).toHaveBeenCalledWith(error, expect.anything())
	})
})
