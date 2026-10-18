import { describe, expect, it } from 'vitest'

import { evaluateAgentClaims, readBearerToken } from './agent-bearer'
import { AGENT_TOKEN_AUDIENCE } from './agent-token-audience'

function request(headers: Record<string, string>): Request {
	return new Request('https://vectreal.com/api/v1/me', { headers })
}

describe('readBearerToken', () => {
	it('reads the token from the Authorization header', () => {
		expect(
			readBearerToken(request({ Authorization: 'Bearer abc.def.ghi' }))
		).toEqual({ ok: true, token: 'abc.def.ghi' })
	})

	it('accepts the scheme in any case', () => {
		expect(readBearerToken(request({ Authorization: 'bearer t' }))).toEqual({
			ok: true,
			token: 't'
		})
	})

	it('refuses a request without one', () => {
		expect(readBearerToken(request({}))).toEqual({
			ok: false,
			reason: 'missing'
		})
	})

	it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer a b', 'abc.def.ghi'])(
		'refuses %j as malformed',
		(value) => {
			expect(readBearerToken(request({ Authorization: value }))).toEqual({
				ok: false,
				reason: 'malformed'
			})
		}
	)

	it('refuses a bearer token sent alongside a session cookie', () => {
		expect(
			readBearerToken(
				request({
					Authorization: 'Bearer t',
					Cookie: 'theme=dark; sb-127-auth-token=base64-abc'
				})
			)
		).toEqual({ ok: false, reason: 'mixed' })
	})

	it('ignores cookies that are not a Supabase session', () => {
		expect(
			readBearerToken(
				request({ Authorization: 'Bearer t', Cookie: 'theme=dark' })
			)
		).toEqual({ ok: true, token: 't' })
	})
})

describe('evaluateAgentClaims', () => {
	const agent = {
		aud: AGENT_TOKEN_AUDIENCE,
		client_id: 'client-1',
		sub: 'user-1'
	}

	it('accepts an agent token', () => {
		expect(evaluateAgentClaims(agent)).toEqual({
			ok: true,
			userId: 'user-1',
			clientId: 'client-1'
		})
	})

	it('accepts the audience inside an array', () => {
		expect(
			evaluateAgentClaims({ ...agent, aud: ['other', AGENT_TOKEN_AUDIENCE] })
		).toMatchObject({ ok: true })
	})

	it('refuses a first-party session token', () => {
		expect(
			evaluateAgentClaims({ aud: 'authenticated', sub: 'user-1' })
		).toEqual({ ok: false, reason: 'audience' })
	})

	it('refuses the agent audience without a client', () => {
		const { client_id: _omitted, ...withoutClient } = agent
		expect(evaluateAgentClaims(withoutClient)).toEqual({
			ok: false,
			reason: 'client'
		})
		expect(evaluateAgentClaims({ ...agent, client_id: '' })).toEqual({
			ok: false,
			reason: 'client'
		})
	})

	it.each([undefined, ''])('refuses a token whose subject is %j', (sub) => {
		expect(evaluateAgentClaims({ ...agent, sub })).toEqual({
			ok: false,
			reason: 'subject'
		})
	})
})
