import { apiFailureSchema } from '@vctrl/sdk'
import { describe, expect, it, vi } from 'vitest'

import {
	agentApiEnvelopeMiddleware,
	withAgentApiEnvelope
} from './agent-api-envelope'
import { agentApiError } from './agent-api-response'

const request = (method = 'GET') =>
	new Request('https://vectreal.com/api/v1/me', { method })

const failure = async (response: Response) =>
	apiFailureSchema.parse(await response.json())

describe('withAgentApiEnvelope', () => {
	it("codes React Router's own 405 for a method the route has no handler for", async () => {
		// What `errorResponseToJson` writes for a resource route without an action.
		const framework = Response.json(
			{ message: 'Method Not Allowed' },
			{ status: 405, statusText: 'Method Not Allowed' }
		)

		const response = await withAgentApiEnvelope(request('POST'), framework)

		expect(response.status).toBe(405)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
		expect(await failure(response)).toMatchObject({
			success: false,
			code: 'method_not_allowed',
			error: 'This route does not answer POST.'
		})
	})

	it("codes React Router's plain-text 500 and keeps the error text off the wire", async () => {
		// What `returnLastResortErrorResponse` writes outside production.
		const framework = new Response(
			'Unexpected Server Error\n\nTypeError: secret detail',
			{ status: 500, headers: { 'Content-Type': 'text/plain' } }
		)

		const response = await withAgentApiEnvelope(request(), framework)

		expect(response.status).toBe(500)
		const body = await failure(response)
		expect(body.code).toBe('internal_error')
		expect(JSON.stringify(body)).not.toContain('secret detail')
	})

	it.each([
		[404, 'not_found'],
		[400, 'invalid_request'],
		[503, 'internal_error']
	])('codes an uncoded %i as %s', async (status, code) => {
		const response = await withAgentApiEnvelope(
			request(),
			new Response(null, { status })
		)

		expect(response.status).toBe(status)
		expect((await failure(response)).code).toBe(code)
	})

	it("passes a route's own coded refusal through untouched", async () => {
		const own = agentApiError(403, 'insufficient_scope', 'Needs a scope', {
			extra: { scope: 'projects:write' }
		})

		expect(await withAgentApiEnvelope(request(), own)).toBe(own)
	})

	it('passes a success through untouched', async () => {
		const ok = Response.json({ success: true, data: {} })

		expect(await withAgentApiEnvelope(request(), ok)).toBe(ok)
	})
})

describe('agentApiEnvelopeMiddleware', () => {
	it('codes the response next() returns', async () => {
		const next = vi.fn(async () => new Response('boom', { status: 500 }))

		const response = (await agentApiEnvelopeMiddleware(
			{ request: request() } as Parameters<
				typeof agentApiEnvelopeMiddleware
			>[0],
			next
		)) as Response

		expect(next).toHaveBeenCalledOnce()
		expect((await failure(response)).code).toBe('internal_error')
	})
})
