import { afterEach, describe, expect, it, vi } from 'vitest'

import { ImgTo3dRuntimeError } from './img-to-3d-handlers'
import {
	createMockImgTo3dRuntime,
	getImgTo3dRuntime,
	liveImgTo3dRuntime,
	MOCK_DURATION_MS
} from './img-to-3d-runtime-client.server'

const JOB = '00000000-0000-4000-8000-000000000001'

afterEach(() => {
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
})

describe('the mock runtime', () => {
	function clocked() {
		let now = 0
		const runtime = createMockImgTo3dRuntime(() => now)
		return { runtime, advance: (ms: number) => (now += ms) }
	}

	const submission = {
		jobId: JOB,
		seed: 1,
		image: new File([new Uint8Array(1)], 'chair.png', { type: 'image/png' }),
		resolution: 1024,
		textureSize: 2048,
		decimationTarget: 200_000
	} as const

	it('moves a job from queued through processing to a ready model', async () => {
		const { runtime, advance } = clocked()
		await runtime.submit(submission)

		expect(await runtime.status(JOB)).toMatchObject({
			status: 'queued',
			progress: null,
			artifactReady: false
		})

		advance(MOCK_DURATION_MS / 2)
		const midway = await runtime.status(JOB)
		expect(midway.status).toBe('processing')
		expect(midway.progress).toBeGreaterThan(0)
		expect(midway.progress).toBeLessThan(100)
		expect(midway.pollAfterMs).toBeGreaterThan(0)

		advance(MOCK_DURATION_MS / 2)
		expect(await runtime.status(JOB)).toMatchObject({
			status: 'succeeded',
			progress: 100,
			artifactReady: true,
			pollAfterMs: 0
		})
	})

	it('refuses the artifact until the job has finished, then serves a GLB', async () => {
		const { runtime, advance } = clocked()
		await runtime.submit(submission)

		await expect(runtime.artifact(JOB)).rejects.toMatchObject({
			kind: 'runtime_rejected',
			status: 404
		})

		advance(MOCK_DURATION_MS)
		const artifact = await runtime.artifact(JOB)
		const bytes = new Uint8Array(await artifact.arrayBuffer())
		// Every binary glTF starts with the ASCII magic "glTF".
		expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('glTF')
	})

	it('reports a job it never saw as failed, as after a dev-server restart', async () => {
		const { runtime } = clocked()
		expect(await runtime.status(JOB)).toMatchObject({ status: 'failed' })
	})
})

describe('getImgTo3dRuntime', () => {
	it('fakes the runtime in mock mode', () => {
		vi.stubEnv('IMG_TO_3D_MOCK_MODE', 'true')
		expect(getImgTo3dRuntime()).not.toBe(liveImgTo3dRuntime)
	})

	it('calls the real runtime in production even with mock mode set', () => {
		vi.stubEnv('IMG_TO_3D_MOCK_MODE', 'true')
		vi.stubEnv('NODE_ENV', 'production')
		expect(getImgTo3dRuntime()).toBe(liveImgTo3dRuntime)
	})
})

describe('the live runtime client', () => {
	function configured(response: Response | Error) {
		vi.stubEnv('IMG_TO_3D_RUNTIME_BASE_URL', 'https://runtime.modal.test/')
		vi.stubEnv('IMG_TO_3D_RUNTIME_PROXY_KEY', 'wk-key')
		vi.stubEnv('IMG_TO_3D_RUNTIME_PROXY_SECRET', 'ws-secret')
		const fetch = vi.fn(async (_url: string, _init?: RequestInit) => {
			if (response instanceof Error) throw response
			return response
		})
		vi.stubGlobal('fetch', fetch)
		return fetch
	}

	it('is unavailable, not broken, on a deployment without its secrets', async () => {
		vi.stubEnv('IMG_TO_3D_RUNTIME_BASE_URL', '')
		await expect(liveImgTo3dRuntime.status(JOB)).rejects.toMatchObject({
			kind: 'runtime_unavailable',
			status: 503
		})
	})

	it('authenticates at Modal’s proxy, without a doubled slash', async () => {
		const fetch = configured(
			Response.json({
				success: true,
				data: {
					jobId: JOB,
					status: 'queued',
					progress: null,
					message: null,
					artifactReady: false,
					pollAfterMs: 2000
				}
			})
		)

		await liveImgTo3dRuntime.status(JOB)

		expect(fetch).toHaveBeenCalledWith(
			`https://runtime.modal.test/generations/${JOB}`,
			expect.objectContaining({
				headers: { 'Modal-Key': 'wk-key', 'Modal-Secret': 'ws-secret' }
			})
		)
	})

	it.each([
		['a runtime 5xx as our upstream failing', 500, 'runtime_unavailable', 502],
		['a runtime 4xx as a refusal', 422, 'runtime_rejected', 422]
	])('maps %s', async (_, status, kind, platformStatus) => {
		configured(
			Response.json(
				{ success: false, error: 'Traceback (most recent call last)' },
				{ status }
			)
		)

		const failure = await liveImgTo3dRuntime.status(JOB).catch((e) => e)

		expect(failure).toBeInstanceOf(ImgTo3dRuntimeError)
		expect(failure).toMatchObject({ kind, status: platformStatus })
	})

	it('treats an unreachable runtime as unavailable', async () => {
		configured(new TypeError('fetch failed'))
		await expect(liveImgTo3dRuntime.status(JOB)).rejects.toMatchObject({
			kind: 'runtime_unavailable',
			status: 503
		})
	})

	it('marks a submit that timed out as possibly started', async () => {
		vi.useFakeTimers()
		try {
			configured(new Response())
			vi.stubGlobal(
				'fetch',
				vi.fn(
					(_: string, init: RequestInit) =>
						new Promise((_resolve, reject) =>
							init.signal?.addEventListener('abort', () =>
								reject(new DOMException('aborted', 'AbortError'))
							)
						)
				)
			)

			const failure = liveImgTo3dRuntime
				.submit({
					jobId: JOB,
					seed: 1,
					image: new File([new Uint8Array(1)], 'chair.png'),
					resolution: 1024,
					textureSize: 2048,
					decimationTarget: 200_000
				})
				.catch((e) => e)
			await vi.advanceTimersByTimeAsync(60_000)

			expect(await failure).toMatchObject({
				kind: 'runtime_unavailable',
				outcomeUnknown: true
			})
		} finally {
			vi.useRealTimers()
		}
	})

	it('does not cut off an artifact still streaming after its answer arrived', async () => {
		vi.useFakeTimers()
		try {
			const fetch = configured(new Response('glb'))

			await liveImgTo3dRuntime.artifact(JOB)
			await vi.advanceTimersByTimeAsync(10 * 60_000)

			const init = fetch.mock.calls[0]?.[1] as RequestInit | undefined
			expect(init?.signal?.aborted).toBe(false)
		} finally {
			vi.useRealTimers()
		}
	})

	it('treats a runtime it never connected to as a definite failure', async () => {
		configured(
			new TypeError('fetch failed', {
				cause: Object.assign(new Error('connect'), { code: 'ECONNREFUSED' })
			})
		)
		await expect(liveImgTo3dRuntime.status(JOB)).rejects.toMatchObject({
			kind: 'runtime_unavailable',
			outcomeUnknown: false
		})
	})

	it('treats a connection lost after sending as possibly acted on', async () => {
		configured(
			new TypeError('fetch failed', {
				cause: Object.assign(new Error('other side closed'), {
					code: 'UND_ERR_SOCKET'
				})
			})
		)
		await expect(liveImgTo3dRuntime.status(JOB)).rejects.toMatchObject({
			kind: 'runtime_unavailable',
			outcomeUnknown: true
		})
	})

	it('refuses a job state of the wrong shape', async () => {
		configured(
			Response.json({ success: true, data: { jobId: JOB, status: 'done' } })
		)
		await expect(liveImgTo3dRuntime.status(JOB)).rejects.toMatchObject({
			kind: 'runtime_unavailable',
			status: 502
		})
	})
})
