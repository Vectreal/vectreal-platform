import { apiSuccessSchema, meSchema } from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loader } from './me'

import type { Route } from './+types/me'

const { authorizeAgentRequest, getOrgSubscription } = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	getOrgSubscription: vi.fn()
}))

vi.mock('../../../lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest
}))
vi.mock('../../../lib/domain/billing/entitlement-service.server', () => ({
	getOrgSubscription
}))

const request = new Request('https://vectreal.com/api/v1/me')

beforeEach(() => {
	authorizeAgentRequest.mockReset().mockResolvedValue({
		userId: 'user-1',
		email: null,
		clientId: 'client-1',
		grantId: 'grant-1',
		organizationId: 'org-1',
		organizationName: 'Acme',
		role: 'admin',
		scopes: ['projects:read', 'scenes:write']
	})
	getOrgSubscription
		.mockReset()
		.mockResolvedValue({ plan: 'pro', billingState: 'active' })
})

describe('GET /api/v1/me', () => {
	it('answers in the shape the SDK reads, without caching', async () => {
		const response = await loader({ request } as Route.LoaderArgs)

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
		// Through the gate, so the grant's rate limit covers it too.
		expect(authorizeAgentRequest).toHaveBeenCalledWith(request, {
			scope: 'any'
		})
	})
})
