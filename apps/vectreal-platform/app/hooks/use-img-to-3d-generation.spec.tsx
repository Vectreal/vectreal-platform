// @vitest-environment jsdom
/**
 * The client half of generation: submit, poll each variant until it ends,
 * open one. What these hold is that a variant always ends - a refusal stops
 * its polling instead of leaving it "Queued" for as long as the tab is open -
 * and that only a kind, never server text, reaches the panel.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useImgTo3dGeneration } from './use-img-to-3d-generation'

vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))

const JOB = '00000000-0000-4000-8000-000000000002'

type Route = (url: string, init?: RequestInit) => Response
let route: Route
const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
	route(url, init)
)

function envelope(data: unknown, status = 200): Response {
	return Response.json({ success: true, data }, { status })
}

function refusal(error: string, status: number): Response {
	return Response.json({ success: false, error }, { status })
}

function jobState(status: string) {
	return {
		jobId: JOB,
		status,
		progress: status === 'processing' ? 50 : null,
		message: null,
		artifactReady: status === 'succeeded',
		pollAfterMs: status === 'succeeded' || status === 'failed' ? 0 : 1_000
	}
}

// A body reads once, so every submit gets a fresh one.
const submitted = () =>
	envelope(
		{
			batchId: 'batch',
			jobs: [{ jobId: JOB, seed: 7, status: 'queued', error: null }]
		},
		202
	)

function polls(): number {
	return fetchMock.mock.calls.filter(([url]) => url.endsWith(JOB)).length
}

async function startOne(
	loadModel: (files: File[]) => Promise<unknown> = async () => undefined
) {
	const hook = renderHook(() => useImgTo3dGeneration(loadModel))
	await act(() =>
		hook.result.current.generate(
			new File([new Uint8Array(1)], 'chair.png', { type: 'image/png' }),
			{
				resolution: 1024,
				textureSize: 2048,
				decimationTarget: 200_000,
				seedCount: 1
			}
		)
	)
	return hook
}

async function pollOnce() {
	await act(() => vi.advanceTimersByTimeAsync(2_000))
}

beforeEach(() => {
	vi.useFakeTimers()
	fetchMock.mockClear()
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe('useImgTo3dGeneration', () => {
	it('polls a variant until it succeeds, then stops', async () => {
		let state = 'processing'
		route = (url) =>
			url.endsWith(JOB) ? envelope(jobState(state)) : submitted()
		const { result } = await startOne()

		await pollOnce()
		expect(result.current.candidates[0]).toMatchObject({
			status: 'processing',
			progress: 50
		})

		state = 'succeeded'
		await pollOnce()
		expect(result.current.candidates[0]).toMatchObject({
			status: 'succeeded',
			error: null
		})

		const settled = polls()
		await pollOnce()
		await pollOnce()
		expect(polls()).toBe(settled)
	})

	it('shows a failed generation as its kind, not the runtime’s words', async () => {
		route = (url) =>
			url.endsWith(JOB)
				? envelope({ ...jobState('failed'), message: 'CUDA out of memory' })
				: submitted()
		const { result } = await startOne()

		await pollOnce()
		expect(result.current.candidates[0]).toMatchObject({
			status: 'failed',
			error: 'generation_failed'
		})
	})

	it('ends a variant the server refuses, instead of polling it forever', async () => {
		route = (url) =>
			url.endsWith(JOB) ? refusal('Not found', 404) : submitted()
		const { result } = await startOne()

		await pollOnce()
		expect(result.current.candidates[0]).toMatchObject({
			status: 'failed',
			error: 'unexpected'
		})

		const settled = polls()
		await pollOnce()
		expect(polls()).toBe(settled)
	})

	it.each([
		['a runtime outage', 'runtime_unavailable', 503],
		['a rate limit', 'unexpected', 429],
		['a brief auth failure', 'Unauthorized', 401]
	])('keeps polling through %s', async (_, error, status) => {
		let answer: Response | null = refusal(error, status)
		route = (url) => {
			if (!url.endsWith(JOB)) return submitted()
			const next = answer ?? envelope(jobState('processing'))
			answer = null
			return next
		}
		const { result } = await startOne()

		await pollOnce()
		expect(result.current.candidates[0]).toMatchObject({
			status: 'queued',
			error: null
		})

		await pollOnce()
		expect(result.current.candidates[0].status).toBe('processing')
	})

	it('names a refused submit by its kind', async () => {
		route = () => refusal('runtime_unavailable', 503)
		const { result } = await startOne()

		expect(result.current.submitError).toBe('runtime_unavailable')
		expect(result.current.candidates).toEqual([])
	})

	it('opens a ready variant as a GLB file named after its image and seed', async () => {
		route = (url) =>
			url.endsWith('/artifact')
				? new Response('glb')
				: url.endsWith(JOB)
					? envelope(jobState('succeeded'))
					: submitted()
		const loadModel = vi.fn(async (_files: File[]) => undefined)
		const { result } = await startOne(loadModel)
		await pollOnce()

		await act(() => result.current.loadCandidate(JOB))

		const [[files]] = loadModel.mock.calls
		expect(files[0].name).toBe('chair-7.glb')
		expect(files[0].type).toBe('model/gltf-binary')
	})

	it('clears a failed open once the variant is opened again', async () => {
		let artifact = refusal('runtime_unavailable', 503)
		route = (url) =>
			url.endsWith('/artifact')
				? artifact
				: url.endsWith(JOB)
					? envelope(jobState('succeeded'))
					: submitted()
		const { result } = await startOne()
		await pollOnce()

		await act(() => result.current.loadCandidate(JOB))
		expect(result.current.candidates[0].error).toBe('runtime_unavailable')

		artifact = new Response('glb')
		await act(() => result.current.loadCandidate(JOB))
		expect(result.current.candidates[0].error).toBeNull()
	})
})
