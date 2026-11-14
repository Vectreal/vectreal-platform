import { apiSuccessSchema, endedSessionSchema } from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { action } from './session'

import type { Route } from './+types/session'

const { endAgentSession } = vi.hoisted(() => ({
	endAgentSession: vi.fn()
}))

// The gate is held to every route by tests/agent-api-routes.spec.ts; the
// action itself reads only the request, whose token the session belongs to.
vi.mock('../../../lib/domain/agent/agent-request.server', () => ({
	agentGate: vi.fn()
}))
vi.mock('../../../lib/domain/agent/agent-session.server', () => ({
	endAgentSession
}))

const request = (method: string) =>
	new Request('https://vectreal.com/api/v1/session', {
		method,
		headers: { Authorization: 'Bearer token' }
	})

beforeEach(() => {
	endAgentSession.mockReset().mockResolvedValue(undefined)
})

describe('DELETE /api/v1/session', () => {
	it('ends the session behind the token and says so', async () => {
		const ending = request('DELETE')
		const response = await action({ request: ending } as Route.ActionArgs)

		expect(endAgentSession).toHaveBeenCalledWith(ending)
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = await response.json()
		expect(apiSuccessSchema(endedSessionSchema).parse(body)).toEqual(body)
	})
})
