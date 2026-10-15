import { beforeEach, describe, expect, it, vi } from 'vitest'

const guard = vi.hoisted(() => ({
	acquireHeavySceneActionToken: vi.fn(),
	releaseHeavySceneActionToken: vi.fn(),
	acquireSceneWriteLock: vi.fn(),
	releaseSceneWriteLock: vi.fn(),
	buildSceneRequestKey: vi.fn(() => 'request-key'),
	reserveIdempotentSceneRequest: vi.fn(),
	completeIdempotentSceneRequest: vi.fn(),
	failIdempotentSceneRequest: vi.fn()
}))

vi.mock('./scene-action-guard.server', () => guard)

import {
	getSceneSettingsRequestKey,
	runGuardedSceneMutation,
	runWithHeavySceneActionLimit,
	runWithIdempotentSceneRequest,
	runWithSceneSettingsCoalescing,
	runWithSceneWriteLock
} from './scene-request-guards.server'

const ok = (body: unknown = { success: true }) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	})

beforeEach(() => {
	vi.clearAllMocks()
	guard.acquireHeavySceneActionToken.mockResolvedValue(true)
	guard.acquireSceneWriteLock.mockResolvedValue(true)
})

describe('runWithSceneSettingsCoalescing', () => {
	it('answers a burst of identical reads with one operation', async () => {
		let resolve!: (response: Response) => void
		const operation = vi.fn(
			() => new Promise<Response>((done) => (resolve = done))
		)

		const first = runWithSceneSettingsCoalescing('user:scene', operation)
		const second = runWithSceneSettingsCoalescing('user:scene', operation)
		resolve(ok())

		expect(await first).toBe(await second)
		expect(operation).toHaveBeenCalledTimes(1)
	})

	it('keeps one user from being answered with the read of another', async () => {
		expect(getSceneSettingsRequestKey('u1', 's1')).not.toBe(
			getSceneSettingsRequestKey('u2', 's1')
		)
		expect(getSceneSettingsRequestKey('u1', 's1')).not.toBe(
			getSceneSettingsRequestKey('u1', 's2')
		)
	})

	it('runs again once the first read has settled', async () => {
		const operation = vi.fn(async () => ok())

		await runWithSceneSettingsCoalescing('user:scene', operation)
		await runWithSceneSettingsCoalescing('user:scene', operation)

		expect(operation).toHaveBeenCalledTimes(2)
	})
})

describe('runWithHeavySceneActionLimit', () => {
	it('refuses with 503 and runs nothing when the server is saturated', async () => {
		guard.acquireHeavySceneActionToken.mockResolvedValue(false)
		const operation = vi.fn(async () => ok())

		const response = await runWithHeavySceneActionLimit(operation)

		expect(response.status).toBe(503)
		expect(operation).not.toHaveBeenCalled()
		expect(guard.releaseHeavySceneActionToken).not.toHaveBeenCalled()
	})

	it('asks for one of two slots and gives it back after the work', async () => {
		await runWithHeavySceneActionLimit(async () => ok())

		expect(guard.acquireHeavySceneActionToken).toHaveBeenCalledWith(2)
		expect(guard.releaseHeavySceneActionToken).toHaveBeenCalledTimes(1)
	})

	it('gives the token back even when the work throws', async () => {
		await expect(
			runWithHeavySceneActionLimit(async () => {
				throw new Error('boom')
			})
		).rejects.toThrow('boom')

		expect(guard.releaseHeavySceneActionToken).toHaveBeenCalledTimes(1)
	})
})

describe('runWithSceneWriteLock', () => {
	it('refuses with 409 and runs nothing while another writer holds the scene', async () => {
		guard.acquireSceneWriteLock.mockResolvedValue(false)
		const operation = vi.fn(async () => ok())

		const response = await runWithSceneWriteLock('scene', 'holder', operation)

		expect(response.status).toBe(409)
		expect(operation).not.toHaveBeenCalled()
	})

	it('releases the lock when the work throws', async () => {
		await expect(
			runWithSceneWriteLock('scene', 'holder', async () => {
				throw new Error('boom')
			})
		).rejects.toThrow('boom')

		expect(guard.releaseSceneWriteLock).toHaveBeenCalledTimes(1)
	})

	it('releases the lock it took, for the same holder', async () => {
		await runWithSceneWriteLock('scene', 'holder', async () => ok())

		expect(guard.acquireSceneWriteLock).toHaveBeenCalledWith({
			sceneId: 'scene',
			holderKey: 'holder'
		})
		expect(guard.releaseSceneWriteLock).toHaveBeenCalledWith({
			sceneId: 'scene',
			holderKey: 'holder'
		})
	})
})

describe('runWithIdempotentSceneRequest', () => {
	const params = { userId: 'u1', action: 'commit-scene-save', sceneId: 's1' }

	it('runs a request with no id straight through', async () => {
		const operation = vi.fn(async () => ok())

		await runWithIdempotentSceneRequest({ ...params, operation })

		expect(operation).toHaveBeenCalledTimes(1)
		expect(guard.reserveIdempotentSceneRequest).not.toHaveBeenCalled()
	})

	it('replays a completed request without running it again', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: false,
			record: {
				status: 'completed',
				responseStatus: 201,
				responseBody: { success: true, data: 'saved' }
			}
		})
		const operation = vi.fn(async () => ok())

		const response = await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation
		})

		expect(operation).not.toHaveBeenCalled()
		expect(response.status).toBe(201)
		expect(await response.json()).toEqual({ success: true, data: 'saved' })
	})

	it('runs a fresh reservation once and records its result', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: true,
			record: { status: 'pending' }
		})

		const response = await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation: async () => ok({ success: true, data: 1 })
		})

		expect(response.status).toBe(200)
		expect(guard.completeIdempotentSceneRequest).toHaveBeenCalledWith({
			requestKey: 'request-key',
			responseStatus: 200,
			responseBody: { success: true, data: 1 }
		})
	})

	it('keys the request on its id, user, action and scene', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: true,
			record: { status: 'pending' }
		})

		await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation: async () => ok()
		})

		expect(guard.buildSceneRequestKey).toHaveBeenCalledWith({
			requestId: 'r1',
			userId: 'u1',
			action: 'commit-scene-save',
			sceneId: 's1'
		})
	})

	it('records a failed response as failed, so it is not replayed', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: true,
			record: { status: 'pending' }
		})

		const response = await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation: async () =>
				new Response(JSON.stringify({ success: false, error: 'Bad scene' }), {
					status: 400
				})
		})

		expect(response.status).toBe(400)
		expect(guard.completeIdempotentSceneRequest).not.toHaveBeenCalled()
		expect(guard.failIdempotentSceneRequest).toHaveBeenCalledWith({
			requestKey: 'request-key',
			errorMessage: 'Bad scene'
		})
	})

	it('records a response with no JSON body by its status alone', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: true,
			record: { status: 'pending' }
		})

		await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation: async () => new Response('saved', { status: 200 })
		})
		expect(guard.completeIdempotentSceneRequest).toHaveBeenCalledWith({
			requestKey: 'request-key',
			responseStatus: 200,
			responseBody: {}
		})

		await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r2',
			operation: async () => new Response('oops', { status: 502 })
		})
		expect(guard.failIdempotentSceneRequest).toHaveBeenCalledWith({
			requestKey: 'request-key',
			errorMessage: 'Request failed with status 502'
		})
	})

	it('answers 500 when the request state cannot be reserved', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue(null)
		const operation = vi.fn(async () => ok())

		const response = await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation
		})

		expect(response.status).toBe(500)
		expect(operation).not.toHaveBeenCalled()
	})

	it('replays a completed request with no recorded status as 200', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: false,
			record: { status: 'completed', responseBody: { success: true } }
		})

		const response = await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation: async () => ok()
		})

		expect(response.status).toBe(200)
	})

	it('treats a completed record with no body as still in flight', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: false,
			record: { status: 'completed', responseStatus: 200, responseBody: null }
		})

		const response = await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation: async () => ok()
		})

		expect(response.status).toBe(409)
	})

	it('records a JSON failure with no message by its status', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: true,
			record: { status: 'pending' }
		})

		await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation: async () =>
				new Response(JSON.stringify({ success: false }), { status: 422 })
		})

		expect(guard.failIdempotentSceneRequest).toHaveBeenCalledWith({
			requestKey: 'request-key',
			errorMessage: 'Request failed with status 422'
		})
	})

	it('refuses a duplicate while the first is still in flight', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: false,
			record: { status: 'pending' }
		})
		const operation = vi.fn(async () => ok())

		const response = await runWithIdempotentSceneRequest({
			...params,
			requestId: 'r1',
			operation
		})

		expect(response.status).toBe(409)
		expect(operation).not.toHaveBeenCalled()
	})
})

describe('runGuardedSceneMutation', () => {
	it('holds the write lock for this user and request around the work', async () => {
		const operation = vi.fn(async () => ok())

		await runGuardedSceneMutation({
			userId: 'u1',
			action: 'commit-scene-publish',
			sceneId: 's1',
			requestId: undefined,
			operation
		})

		expect(guard.acquireHeavySceneActionToken).toHaveBeenCalled()
		expect(guard.acquireSceneWriteLock).toHaveBeenCalledWith({
			sceneId: 's1',
			holderKey: 'u1:no-request-id'
		})
		expect(operation).toHaveBeenCalledTimes(1)
	})

	it('replays a repeated request id before taking any lock', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: false,
			record: {
				status: 'completed',
				responseStatus: 200,
				responseBody: { success: true }
			}
		})
		const operation = vi.fn(async () => ok())

		await runGuardedSceneMutation({
			userId: 'u1',
			action: 'commit-scene-save',
			sceneId: 's1',
			requestId: 'r1',
			operation
		})

		expect(operation).not.toHaveBeenCalled()
		expect(guard.acquireSceneWriteLock).not.toHaveBeenCalled()
	})

	it('names the lock holder by user and request id', async () => {
		guard.reserveIdempotentSceneRequest.mockResolvedValue({
			created: true,
			record: { status: 'pending' }
		})

		await runGuardedSceneMutation({
			userId: 'u1',
			action: 'commit-scene-save',
			sceneId: 's1',
			requestId: 'r1',
			operation: async () => ok()
		})

		expect(guard.acquireSceneWriteLock).toHaveBeenCalledWith({
			sceneId: 's1',
			holderKey: 'u1:r1'
		})
		expect(guard.buildSceneRequestKey).toHaveBeenCalledWith({
			requestId: 'r1',
			userId: 'u1',
			action: 'commit-scene-save',
			sceneId: 's1'
		})
	})

	it('checks the load limit before it takes the scene lock', async () => {
		guard.acquireHeavySceneActionToken.mockResolvedValue(false)
		const operation = vi.fn(async () => ok())

		const response = await runGuardedSceneMutation({
			userId: 'u1',
			action: 'commit-scene-save',
			sceneId: 's1',
			operation
		})

		expect(response.status).toBe(503)
		expect(guard.acquireSceneWriteLock).not.toHaveBeenCalled()
		expect(operation).not.toHaveBeenCalled()
	})

	it('runs nothing when the scene is locked', async () => {
		guard.acquireSceneWriteLock.mockResolvedValue(false)
		const operation = vi.fn(async () => ok())

		const response = await runGuardedSceneMutation({
			userId: 'u1',
			action: 'revoke-scene-publish',
			sceneId: 's1',
			operation
		})

		expect(response.status).toBe(409)
		expect(operation).not.toHaveBeenCalled()
	})
})
