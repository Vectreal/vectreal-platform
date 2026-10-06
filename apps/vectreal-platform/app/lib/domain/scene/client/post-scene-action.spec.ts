import { describe, expect, it, vi } from 'vitest'

import { postSceneAction } from './post-scene-action'

const respond = (status: number, body: unknown) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('postSceneAction', () => {
	it('posts the body as JSON to the scene API', async () => {
		const fetchImpl = respond(200, { success: true, data: {} })

		await postSceneAction('scene-1', { action: 'x', csrf: 't' }, fetchImpl)

		expect(fetchImpl).toHaveBeenCalledWith('/api/scenes/scene-1', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'x', csrf: 't' })
		})
	})

	it("hands back the API's answer", async () => {
		const answer = { success: true, data: { presentation: {} } }

		expect(await postSceneAction('scene-1', {}, respond(200, answer))).toEqual({
			...answer,
			status: 200
		})
	})

	it("hands back the API's refusal with its message", async () => {
		expect(
			await postSceneAction(
				'scene-1',
				{},
				respond(404, { success: false, error: 'Scene not found' })
			)
		).toEqual({ success: false, error: 'Scene not found', status: 404 })
	})

	it('treats a failing status as a refusal even if the body claims success', async () => {
		const result = await postSceneAction(
			'scene-1',
			{},
			respond(500, { success: true })
		)

		expect(result.success).toBe(false)
	})

	it('resolves to a refusal when the request never gets an answer', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new TypeError('Failed to fetch')
		})

		expect(await postSceneAction('scene-1', {}, fetchImpl)).toEqual({
			success: false,
			error: 'Could not reach the server. Try again.',
			status: 503,
			unreachable: true
		})
	})

	it('resolves to a refusal when the answer is not JSON', async () => {
		const fetchImpl = vi.fn(
			async () => new Response('<html>502 Bad Gateway</html>', { status: 502 })
		)

		expect(await postSceneAction('scene-1', {}, fetchImpl)).toEqual({
			success: false,
			error: 'Could not reach the server. Try again.',
			status: 503,
			unreachable: true
		})
	})
})
