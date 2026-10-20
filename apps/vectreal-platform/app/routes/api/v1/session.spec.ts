import {
	apiFailureSchema,
	apiSuccessSchema,
	endedSessionSchema
} from '@vctrl/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { action, loader } from './session'

import type { Route } from './+types/session'

const { authorizeAgentRequest, endAgentSession } = vi.hoisted(() => ({
	authorizeAgentRequest: vi.fn(),
	endAgentSession: vi.fn()
}))

vi.mock('../../../lib/domain/agent/agent-request.server', () => ({
	authorizeAgentRequest
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
	authorizeAgentRequest.mockReset().mockResolvedValue({ userId: 'user-1' })
	endAgentSession.mockReset().mockResolvedValue(undefined)
})

describe('DELETE /api/v1/session', () => {
	it('ends the session behind the token, with any scope, and says so', async () => {
		const ending = request('DELETE')
		const response = await action({ request: ending } as Route.ActionArgs)

		expect(authorizeAgentRequest).toHaveBeenCalledWith(ending, { scope: 'any' })
		expect(endAgentSession).toHaveBeenCalledWith(ending)
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		const body = await response.json()
		expect(apiSuccessSchema(endedSessionSchema).parse(body)).toEqual(body)
	})

	it('ends nothing for a token the gate refuses', async () => {
		authorizeAgentRequest.mockRejectedValue(
			new Response('gate', { status: 401 })
		)

		await expect(
			action({ request: request('DELETE') } as Route.ActionArgs)
		).rejects.toBeInstanceOf(Response)
		expect(endAgentSession).not.toHaveBeenCalled()
	})

	it.each(['POST', 'PUT'])(
		'answers %s with 405, ending nothing',
		async (method) => {
			const response = await action({
				request: request(method)
			} as Route.ActionArgs)

			expect(response.status).toBe(405)
			expect(response.headers.get('Allow')).toBe('DELETE')
			expect(apiFailureSchema.parse(await response.json()).code).toBe(
				'method_not_allowed'
			)
			expect(endAgentSession).not.toHaveBeenCalled()
		}
	)

	it('answers GET with 405 after the gate', async () => {
		const response = await loader({
			request: request('GET')
		} as Route.LoaderArgs)

		expect(authorizeAgentRequest).toHaveBeenCalled()
		expect(response.status).toBe(405)
	})
})
