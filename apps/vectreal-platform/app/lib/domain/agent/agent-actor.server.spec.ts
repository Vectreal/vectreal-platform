/**
 * `resolveAgentActor` with Supabase Auth and the grant lookup stubbed: the
 * order of its checks and that each refusal stays a refusal. The real Auth
 * half (JWKS signature, a revoked session answering `session_not_found`) needs
 * a running Auth server, which CI's integration job does not have; the grant
 * join is covered by `tests/integration/agent-grant-for-member`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveAgentActor } from './agent-actor.server'
import { AGENT_TOKEN_AUDIENCE } from './agent-token-audience'

const auth = vi.hoisted(() => ({
	getClaims: vi.fn(),
	getUser: vi.fn()
}))
const findAgentGrantForMember = vi.hoisted(() => vi.fn())
const createClient = vi.hoisted(() => vi.fn(() => ({ auth })))

vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('./agent-grant-repository.server', () => ({ findAgentGrantForMember }))

const agentClaims = {
	aud: AGENT_TOKEN_AUDIENCE,
	client_id: 'client-1',
	sub: 'user-1'
}
const grant = {
	id: 'grant-1',
	organizationId: 'org-1',
	organizationName: 'Org',
	role: 'admin',
	scopes: ['projects:read']
}

function request(headers: Record<string, string> = {}): Request {
	return new Request('https://vectreal.com/api/v1/me', {
		headers: { Authorization: 'Bearer a.b.c', ...headers }
	})
}

async function refusal(req: Request): Promise<Response> {
	const thrown = await resolveAgentActor(req).then(
		() => null,
		(error: unknown) => error
	)
	expect(thrown).toBeInstanceOf(Response)
	return thrown as Response
}

/** Every refusal but a mixed request tells the client to sign in again. */
async function expectInvalidToken(req: Request): Promise<void> {
	const response = await refusal(req)
	expect(response.status).toBe(401)
	expect(response.headers.get('WWW-Authenticate')).toBe(
		'Bearer error="invalid_token"'
	)
}

beforeEach(() => {
	vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321')
	vi.stubEnv('SUPABASE_KEY', 'sb_publishable_test')
	auth.getClaims.mockReset().mockResolvedValue({
		data: { claims: agentClaims },
		error: null
	})
	auth.getUser.mockReset().mockResolvedValue({
		data: { user: { id: 'user-1', email: 'agent@example.test' } },
		error: null
	})
	findAgentGrantForMember.mockReset().mockResolvedValue(grant)
})

describe('resolveAgentActor', () => {
	it('resolves the actor the grant describes', async () => {
		await expect(resolveAgentActor(request())).resolves.toEqual({
			userId: 'user-1',
			email: 'agent@example.test',
			clientId: 'client-1',
			grantId: 'grant-1',
			organizationId: 'org-1',
			organizationName: 'Org',
			role: 'admin',
			scopes: ['projects:read']
		})
		expect(auth.getClaims).toHaveBeenCalledWith('a.b.c')
		expect(findAgentGrantForMember).toHaveBeenCalledWith('user-1', 'client-1')
	})

	it('verifies with the publishable key and keeps no session between requests', async () => {
		await resolveAgentActor(request())
		await resolveAgentActor(request())

		expect(createClient).toHaveBeenCalledTimes(1)
		expect(createClient).toHaveBeenCalledWith(
			'http://127.0.0.1:54321',
			'sb_publishable_test',
			{ auth: { autoRefreshToken: false, persistSession: false } }
		)
	})

	it('refuses a session cookie sent beside the token with 400', async () => {
		const response = await refusal(request({ Cookie: 'sb-127-auth-token=x' }))
		expect(response.status).toBe(400)
		expect(auth.getClaims).not.toHaveBeenCalled()
	})

	it('refuses a missing token as invalid', async () => {
		await expectInvalidToken(new Request('https://vectreal.com/api/v1/me'))
	})

	it('refuses a token that does not verify', async () => {
		auth.getClaims.mockResolvedValue({
			data: null,
			error: new Error('Invalid JWT signature')
		})
		await expectInvalidToken(request())
	})

	it('refuses a token the verifier reports an error for, even with claims', async () => {
		auth.getClaims.mockResolvedValue({
			data: { claims: agentClaims },
			error: new Error('Invalid JWT signature')
		})
		await expectInvalidToken(request())
		expect(auth.getUser).not.toHaveBeenCalled()
	})

	it('refuses a token the verifier cannot even parse, rather than failing', async () => {
		auth.getClaims.mockRejectedValue(new SyntaxError('Unexpected token'))
		await expectInvalidToken(request())
	})

	it('refuses a first-party session token before asking Auth or the database', async () => {
		auth.getClaims.mockResolvedValue({
			data: { claims: { aud: 'authenticated', sub: 'user-1' } },
			error: null
		})
		await expectInvalidToken(request())
		expect(auth.getUser).not.toHaveBeenCalled()
		expect(findAgentGrantForMember).not.toHaveBeenCalled()
	})

	it('refuses a token whose session Auth no longer knows', async () => {
		auth.getUser.mockResolvedValue({
			data: { user: null },
			error: { status: 403, code: 'session_not_found' }
		})
		await expectInvalidToken(request())
		expect(auth.getUser).toHaveBeenCalledWith('a.b.c')
		expect(findAgentGrantForMember).not.toHaveBeenCalled()
	})

	it('refuses when Auth reports an error, even alongside a user', async () => {
		auth.getUser.mockResolvedValue({
			data: { user: { id: 'user-1', email: 'agent@example.test' } },
			error: { status: 403, code: 'session_not_found' }
		})
		await expectInvalidToken(request())
		expect(findAgentGrantForMember).not.toHaveBeenCalled()
	})

	it('refuses when Auth returns no user without an error', async () => {
		auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
		await expectInvalidToken(request())
		expect(findAgentGrantForMember).not.toHaveBeenCalled()
	})

	it('reports a user without an email as null', async () => {
		auth.getUser.mockResolvedValue({
			data: { user: { id: 'user-1' } },
			error: null
		})
		await expect(resolveAgentActor(request())).resolves.toMatchObject({
			email: null
		})
	})

	it('refuses a token with no grant in an organization the user still belongs to', async () => {
		findAgentGrantForMember.mockResolvedValue(null)
		await expectInvalidToken(request())
	})
})
