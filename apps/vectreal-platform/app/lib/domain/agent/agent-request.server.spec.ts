import { apiFailureSchema } from '@vctrl/sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	AGENT_API_RATE_LIMIT,
	authorizeAgentRequest
} from './agent-request.server'
import { __resetRateLimitsForTest } from '../../http/rate-limit.server'

import type { AgentActor } from './agent-actor.server'

const resolveAgentActor = vi.hoisted(() => vi.fn())

vi.mock('./agent-actor.server', () => ({ resolveAgentActor }))

const actor: AgentActor = {
	userId: 'user-1',
	email: null,
	clientId: 'client-1',
	grantId: 'grant-1',
	organizationId: 'org-1',
	organizationName: 'Acme',
	role: 'member',
	scopes: ['projects:read']
}

function requestFrom(ip = '203.0.113.10') {
	return new Request('https://vectreal.com/api/v1/projects', {
		headers: { 'cf-connecting-ip': ip, Authorization: 'Bearer a.b.c' }
	})
}

async function refusal(promise: Promise<unknown>): Promise<Response> {
	const thrown = await promise.then(
		() => null,
		(error: unknown) => error
	)
	expect(thrown).toBeInstanceOf(Response)
	return thrown as Response
}

async function spend(times: number, request = () => requestFrom()) {
	for (let call = 0; call < times; call += 1) {
		await authorizeAgentRequest(request(), { scope: 'any' })
	}
}

beforeEach(() => {
	__resetRateLimitsForTest()
	resolveAgentActor.mockReset().mockResolvedValue(actor)
})

afterEach(() => {
	__resetRateLimitsForTest()
})

describe('authorizeAgentRequest', () => {
	it('returns the actor when the grant carries the scope', async () => {
		await expect(
			authorizeAgentRequest(requestFrom(), { scope: 'projects:read' })
		).resolves.toEqual(actor)
	})

	it("admits any grant to a route that asks for 'any'", async () => {
		await expect(
			authorizeAgentRequest(requestFrom(), { scope: 'any' })
		).resolves.toEqual(actor)
	})

	it('refuses a missing scope with 403 insufficient_scope, naming it', async () => {
		const response = await refusal(
			authorizeAgentRequest(requestFrom(), { scope: 'scenes:publish' })
		)

		expect(response.status).toBe(403)
		expect(response.headers.get('WWW-Authenticate')).toBe(
			'Bearer error="insufficient_scope", scope="scenes:publish"'
		)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = apiFailureSchema.parse(await response.json())
		expect(body).toMatchObject({
			code: 'insufficient_scope',
			scope: 'scenes:publish'
		})
	})

	it('passes the actor refusal through untouched', async () => {
		const invalid = new Response(null, { status: 401 })
		resolveAgentActor.mockRejectedValue(invalid)

		await expect(
			authorizeAgentRequest(requestFrom(), { scope: 'any' })
		).rejects.toBe(invalid)
	})

	it('refuses the request past the limit with 429 rate_limited and Retry-After', async () => {
		await spend(AGENT_API_RATE_LIMIT.maxRequests)

		const response = await refusal(
			authorizeAgentRequest(requestFrom(), { scope: 'any' })
		)
		expect(response.status).toBe(429)
		expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
		expect(apiFailureSchema.parse(await response.json()).code).toBe(
			'rate_limited'
		)
	})

	it('counts one grant across addresses, and two grants behind one address apart', async () => {
		let address = 0
		await spend(AGENT_API_RATE_LIMIT.maxRequests, () =>
			requestFrom(`198.51.100.${(address += 1) % 250}`)
		)
		await expect(
			refusal(authorizeAgentRequest(requestFrom('192.0.2.1'), { scope: 'any' }))
		).resolves.toHaveProperty('status', 429)

		// Same user, another client: its own grant, its own budget.
		resolveAgentActor.mockResolvedValue({
			...actor,
			clientId: 'client-2',
			grantId: 'grant-2'
		})
		await expect(
			authorizeAgentRequest(requestFrom(), { scope: 'any' })
		).resolves.toMatchObject({ grantId: 'grant-2' })
	})

	it('spends budget on a scope refusal too', async () => {
		for (let call = 0; call < AGENT_API_RATE_LIMIT.maxRequests; call += 1) {
			await refusal(
				authorizeAgentRequest(requestFrom(), { scope: 'scenes:publish' })
			)
		}

		const response = await refusal(
			authorizeAgentRequest(requestFrom(), { scope: 'projects:read' })
		)
		expect(response.status).toBe(429)
	})
})
