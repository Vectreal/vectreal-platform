import { apiSuccessSchema, meSchema } from '@vctrl/sdk'
import { RouterContextProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loader } from './me'
import { agentActorContext } from '../../../lib/domain/agent/agent-actor-context'

import type { Route } from './+types/me'

const { getOrgSubscription } = vi.hoisted(() => ({
	getOrgSubscription: vi.fn()
}))

// The gate is held to every route by tests/agent-api-routes.spec.ts; a
// handler here runs on the actor the gate would have put in context.
vi.mock('../../../lib/domain/agent/agent-request.server', () => ({
	agentGate: vi.fn()
}))

const contextFor = (actor: unknown) =>
	new RouterContextProvider(new Map([[agentActorContext, actor]]))
vi.mock('../../../lib/domain/billing/entitlement-service.server', () => ({
	getOrgSubscription
}))

const request = new Request('https://vectreal.com/api/v1/me')

const actor = {
	userId: 'user-1',
	email: null,
	clientId: 'client-1',
	grantId: 'grant-1',
	organizationId: 'org-1',
	organizationName: 'Acme',
	role: 'admin',
	scopes: ['projects:read', 'scenes:write']
}

beforeEach(() => {
	getOrgSubscription
		.mockReset()
		.mockResolvedValue({ plan: 'pro', billingState: 'active' })
})

describe('GET /api/v1/me', () => {
	it('answers in the shape the SDK reads, without caching', async () => {
		const response = await loader({
			request,
			context: contextFor(actor)
		} as unknown as Route.LoaderArgs)

		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = await response.json()
		expect(apiSuccessSchema(meSchema).parse(body)).toEqual(body)
		expect(body.data).toEqual({
			user: { id: 'user-1', email: null },
			organization: { id: 'org-1', name: 'Acme', role: 'admin' },
			client: { id: 'client-1' },
			scopes: ['projects:read', 'scenes:write'],
			plan: { plan: 'pro', billingState: 'active' }
		})
		expect(getOrgSubscription).toHaveBeenCalledWith('org-1')
	})
})
