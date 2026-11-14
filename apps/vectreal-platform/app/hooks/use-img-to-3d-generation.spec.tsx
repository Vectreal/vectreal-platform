// @vitest-environment jsdom
/**
 * The client half of generation. Polling: a variant always ends - a refusal
 * stops its polling instead of leaving it "Queued" for as long as the tab is
 * open - and only a kind, never server text, reaches the screen. Opening: the
 * variant the URL names is opened once, named as the server named it.
 */
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { dispositionFileName } from '@vctrl/core/model-loader'
import { StrictMode, useState } from 'react'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	MAX_CONSECUTIVE_POLL_FAILURES,
	useImgTo3dBatchStates,
	useImgTo3dGeneration,
	type ImgTo3dGeneration
} from './use-img-to-3d-generation'
import {
	imgTo3dContentDisposition,
	type ImgTo3dListedBatch
} from '../lib/domain/img-to-3d/img-to-3d-contract'

import type { useSceneUpload } from './scene-loader/use-scene-upload'

type OpenModel = ReturnType<typeof useSceneUpload>['openModel']
type LoadModel = (files: File[]) => Promise<{ status: string }>

vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const JOB = '00000000-0000-4000-8000-000000000002'
const SECOND = '00000000-0000-4000-8000-000000000003'

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

function jobState(status: string, jobId = JOB) {
	return {
		jobId,
		status,
		progress: status === 'processing' ? 50 : null,
		message: null,
		artifactReady: status === 'succeeded',
		pollAfterMs: status === 'succeeded' || status === 'failed' ? 0 : 1_000
	}
}

function batch(
	jobId: string,
	overrides: Partial<ImgTo3dListedBatch> = {}
): ImgTo3dListedBatch {
	return {
		batchId: `batch-${jobId}`,
		sourceName: 'chair',
		createdByName: 'Moritz',
		createdAt: '2026-11-13T10:00:00.000Z',
		keptUntil: '2026-11-20T10:00:00.000Z',
		expired: false,
		variants: [
			{ jobId, seed: 7, status: 'queued', progress: null, error: null }
		],
		...overrides
	}
}

function pollsOf(jobId: string): number {
	return fetchMock.mock.calls.filter(([url]) => url.endsWith(jobId)).length
}

async function pollOnce() {
	await act(() => vi.advanceTimersByTimeAsync(2_000))
}

/** The states hook over a fixed list, and the one variant's state in it. */
function watch(batches: readonly ImgTo3dListedBatch[]) {
	const hook = renderHook(({ list }) => useImgTo3dBatchStates(list), {
		initialProps: { list: batches }
	})
	return {
		...hook,
		state: (jobId = JOB) => {
			const variant = batches
				.flatMap((b) => b.variants)
				.find((v) => v.jobId === jobId)
			if (!variant) throw new Error(`no variant ${jobId}`)
			return hook.result.current(variant)
		}
	}
}

beforeEach(() => {
	// Reset, not cleared: a test that holds its downloads replaces the implementation.
	fetchMock.mockReset()
	fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
		route(url, init)
	)
	vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe('useImgTo3dBatchStates', () => {
	beforeEach(() => vi.useFakeTimers())

	it('polls a variant until it succeeds, then stops', async () => {
		let state = 'processing'
		route = () => envelope(jobState(state))
		const { state: stateOf } = watch([batch(JOB)])

		await pollOnce()
		expect(stateOf()).toMatchObject({ status: 'processing', progress: 50 })

		state = 'succeeded'
		await pollOnce()
		expect(stateOf()).toMatchObject({ status: 'succeeded', error: null })

		const settled = pollsOf(JOB)
		await pollOnce()
		await pollOnce()
		expect(pollsOf(JOB)).toBe(settled)
	})

	it('never polls a variant the list already has an end for, or an expired batch', async () => {
		route = () => envelope(jobState('processing'))
		const done = batch(JOB, {
			variants: [
				{ jobId: JOB, seed: 7, status: 'succeeded', progress: 100, error: null }
			]
		})
		const expired = batch(SECOND, { expired: true })
		watch([done, expired])

		await pollOnce()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('shows a failed generation as its kind, not the runtime’s words', async () => {
		route = () =>
			envelope({ ...jobState('failed'), message: 'CUDA out of memory' })
		const { state } = watch([batch(JOB)])

		await pollOnce()
		expect(state()).toMatchObject({
			status: 'failed',
			error: 'generation_failed'
		})
	})

	it('ends a variant the runtime does not know at once', async () => {
		route = () => refusal('runtime_rejected', 404)
		const { state } = watch([batch(JOB)])

		await pollOnce()
		expect(state()).toMatchObject({
			status: 'failed',
			error: 'runtime_rejected'
		})

		const settled = pollsOf(JOB)
		await pollOnce()
		expect(pollsOf(JOB)).toBe(settled)
	})

	it('rides out a gate 404, which a failed flag evaluation also produces', async () => {
		let answer: Response | null = refusal('Not found', 404)
		route = () => {
			const next = answer ?? envelope(jobState('processing'))
			answer = null
			return next
		}
		const { state } = watch([batch(JOB)])

		await pollOnce()
		expect(state().status).toBe('queued')

		await pollOnce()
		expect(state().status).toBe('processing')
	})

	it('gives a variant up after too many failed polls in a row, and stops', async () => {
		route = () => refusal('runtime_unavailable', 503)
		const { state } = watch([batch(JOB)])

		for (let i = 1; i < MAX_CONSECUTIVE_POLL_FAILURES; i++) await pollOnce()
		expect(state().status).toBe('queued')

		await pollOnce()
		expect(state()).toMatchObject({
			status: 'failed',
			error: 'runtime_unavailable'
		})

		const settled = pollsOf(JOB)
		await pollOnce()
		expect(pollsOf(JOB)).toBe(settled)
	})

	it('counts only failures in a row: a good poll starts the count again', async () => {
		let failing = true
		route = () =>
			failing
				? refusal('runtime_unavailable', 503)
				: envelope(jobState('processing'))
		const { state } = watch([batch(JOB)])

		for (let i = 1; i < MAX_CONSECUTIVE_POLL_FAILURES; i++) await pollOnce()
		failing = false
		await pollOnce()
		failing = true
		for (let i = 1; i < MAX_CONSECUTIVE_POLL_FAILURES; i++) await pollOnce()

		expect(state().status).toBe('processing')
	})

	it.each([
		['a runtime outage', 'runtime_unavailable', 503],
		['a rate limit', 'unexpected', 429],
		['a brief auth failure', 'Unauthorized', 401]
	])('keeps polling through %s', async (_, error, status) => {
		let answer: Response | null = refusal(error, status)
		route = () => {
			const next = answer ?? envelope(jobState('processing'))
			answer = null
			return next
		}
		const { state } = watch([batch(JOB)])

		await pollOnce()
		expect(state()).toMatchObject({ status: 'queued', error: null })

		await pollOnce()
		expect(state().status).toBe('processing')
	})

	it('polls a newly listed variant at the default pace, whatever the others asked for', async () => {
		// The runtime asks for a slow pace on everything it is running.
		route = (url) =>
			envelope({
				...jobState('processing', url.endsWith(SECOND) ? SECOND : JOB),
				pollAfterMs: 30_000
			})
		const first = [batch(JOB)]
		const hook = watch(first)
		await pollOnce()

		hook.rerender({ list: [batch(SECOND), ...first] })
		await pollOnce()

		expect(pollsOf(SECOND)).toBe(1)
	})

	it('starts a revalidated list from its own states, not an older poll', async () => {
		route = () => envelope(jobState('processing'))
		const hook = watch([batch(JOB)])
		await pollOnce()
		expect(hook.state().status).toBe('processing')

		const fresher = [
			batch(JOB, {
				variants: [
					{
						jobId: JOB,
						seed: 7,
						status: 'succeeded',
						progress: 100,
						error: null
					}
				]
			})
		]
		hook.rerender({ list: fresher })

		expect(hook.result.current(fresher[0].variants[0]).status).toBe('succeeded')
	})

	it('keeps a polled state through a revalidation that knows nothing newer', async () => {
		route = () => envelope(jobState('succeeded'))
		const hook = watch([batch(JOB)])
		await pollOnce()

		// The publisher's list never asks the runtime: every state comes back null.
		const unasked = [
			batch(JOB, {
				variants: [
					{ jobId: JOB, seed: 7, status: null, progress: null, error: null }
				]
			})
		]
		hook.rerender({ list: unasked })

		expect(hook.result.current(unasked[0].variants[0]).status).toBe('succeeded')
	})

	it('asks about unknown states first, and only a few at a time', async () => {
		route = (url) => envelope(jobState('processing', url.split('/').pop()))
		const running = Array.from({ length: 15 }, (_, index) =>
			batch(`running-${index}`)
		)
		const unknown = batch('unknown', {
			variants: [
				{ jobId: 'unknown', seed: 1, status: null, progress: null, error: null }
			]
		})
		watch([...running, unknown])

		await pollOnce()
		expect(fetchMock).toHaveBeenCalledTimes(12)
		expect(pollsOf('unknown')).toBe(1)
	})
})

describe('useImgTo3dGeneration', () => {
	// Cleared on every mount, so no test can act on an earlier test's hook.
	let latest: ImgTo3dGeneration | null = null
	// Every render's value, in order, for what a single frame showed.
	let rendered: ImgTo3dGeneration[] = []
	const current = () => {
		if (!latest) throw new Error('the probe has not rendered')
		return latest
	}
	let loads = 0

	// Every source the hook handed the loader, in order.
	let opened: unknown[] = []

	/*
	  `openModel` as far as this hook can tell: it fetches the URL source the
	  way the loader does (so the routes above answer it), says a failure in
	  the caller's words where it gives some, and hands a downloaded model to
	  `loadModel`, which stands for the parse.
	*/
	function loaderOver(loadModel: LoadModel): OpenModel {
		return (async (source, options) => {
			opened.push(source)
			const outcome = (status: string, error: unknown = null) => ({
				status,
				error,
				stillCurrent: () => true
			})
			if (source.kind !== 'url') throw new Error('only URLs here')
			let response: Response
			try {
				response = await fetch(String(source.url), source.init)
			} catch {
				return outcome('empty')
			}
			// As a real fetch does: an aborted request never hands its body over.
			if (source.init?.signal?.aborted) return outcome('empty')
			if (!response.ok) {
				const error = { code: 'url_http', context: { status: response.status } }
				toastError(options?.failureMessage?.(error as never) ?? 'loader')
				return outcome('error', error)
			}
			const name =
				dispositionFileName(response.headers.get('Content-Disposition')) ??
				'model.glb'
			const { status } = await loadModel([new File(['glb'], name)])
			return outcome(status, status === 'error' ? { code: 'parse' } : null)
		}) as OpenModel
	}

	function Probe({ loadModel }: { loadModel: LoadModel }) {
		const { sceneId } = useParams()
		const [openModel] = useState(() => loaderOver(loadModel))
		latest = useImgTo3dGeneration(openModel, sceneId ?? null)
		rendered.push(latest)
		return null
	}

	function mount(
		url: string,
		{
			loadModel = async () => ({ status: 'ready' })
		}: {
			loadModel?: LoadModel
		} = {}
	) {
		loads = 0
		opened = []
		latest = null
		rendered = []
		const router = createMemoryRouter(
			[
				{
					path: '/publisher/:sceneId?',
					HydrateFallback: () => null,
					loader: () => {
						loads += 1
						return null
					},
					element: <Probe loadModel={loadModel} />
				}
			],
			{ initialEntries: [url] }
		)
		// StrictMode mounts twice, which is what would download a variant twice.
		render(
			<StrictMode>
				<RouterProvider router={router} />
			</StrictMode>
		)
		return router
	}

	const glb = () =>
		new Response('glb', {
			headers: {
				'Content-Disposition': imgTo3dContentDisposition('chair-7.glb')
			}
		})

	it('opens the variant the URL names through the loader, by its artifact URL', async () => {
		route = (url) =>
			url.endsWith(`${JOB}/artifact`) ? glb() : refusal('x', 500)
		const loadModel = vi.fn(async (_files: File[]) => ({ status: 'ready' }))
		mount(`/publisher?generation=${JOB}`, { loadModel })

		await waitFor(() => expect(loadModel).toHaveBeenCalledTimes(1))
		// The loader's own download, so the publisher shows its progress.
		expect(opened.at(-1)).toMatchObject({
			kind: 'url',
			url: `/api/img-to-3d/generations/${JOB}/artifact`
		})
		// Named by the route's Content-Disposition, which the loader reads.
		const [[files]] = loadModel.mock.calls
		expect(files[0].name).toBe('chair-7.glb')
		await waitFor(() => expect(current().opening).toBeNull())
	})

	/** An artifact request that answers only when told to. */
	function heldArtifacts() {
		const held = new Map<string, () => void>()
		fetchMock.mockImplementation(
			(url: string, init?: RequestInit) =>
				new Promise<Response>((resolve, reject) => {
					init?.signal?.addEventListener('abort', () =>
						reject(new DOMException('Aborted', 'AbortError'))
					)
					held.set(url.split('/').at(-2) ?? '', () => resolve(glb()))
				})
		)
		return held
	}

	/*
	  The publisher holds its loading surface on this. Set by the open effect
	  instead, it was null for the first render, and on the server, and the
	  empty stage showed in that gap.
	*/
	it('reports the variant as opening from the first render, before any download', async () => {
		const held = heldArtifacts()
		mount(`/publisher?generation=${JOB}`)
		await waitFor(() => expect(held.has(JOB)).toBe(true))

		expect(rendered.length).toBeGreaterThan(0)
		for (const value of rendered) {
			expect(value.opening).toEqual({ jobId: JOB, error: null })
		}
	})

	it('opens nothing over a saved scene, which Save would then overwrite', async () => {
		route = () => glb()
		const loadModel = vi.fn(async (_files: File[]) => ({ status: 'ready' }))
		mount(`/publisher/scene-1?generation=${JOB}`, { loadModel })
		await waitFor(() => expect(latest).not.toBeNull())
		// A few turns more, so the open effect has had every chance to run.
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)))

		expect(fetchMock).not.toHaveBeenCalled()
		expect(loadModel).not.toHaveBeenCalled()
	})

	it('drops a download the URL has left, so Back is not overtaken by it', async () => {
		const held = heldArtifacts()
		const loadModel = vi.fn(async (_files: File[]) => ({ status: 'ready' }))
		const router = mount(`/publisher?generation=${JOB}`, { loadModel })
		await waitFor(() => expect(held.has(JOB)).toBe(true))

		await act(() => router.navigate('/publisher'))
		await act(async () => held.get(JOB)?.())

		expect(loadModel).not.toHaveBeenCalled()
		expect(current().opening).toBeNull()
	})

	it('loads only the latest of two quick opens', async () => {
		const held = heldArtifacts()
		const loadModel = vi.fn(async (_files: File[]) => ({ status: 'ready' }))
		const router = mount(`/publisher?generation=${JOB}`, { loadModel })
		await waitFor(() => expect(held.has(JOB)).toBe(true))

		await act(() => router.navigate(`/publisher?generation=${SECOND}`))
		await waitFor(() => expect(held.has(SECOND)).toBe(true))
		await act(async () => {
			held.get(JOB)?.()
			held.get(SECOND)?.()
		})

		await waitFor(() => expect(loadModel).toHaveBeenCalledTimes(1))
		expect(current().opening).toBeNull()
	})

	it('never reopens on a revalidation, which would load over unsaved edits', async () => {
		route = () => glb()
		const loadModel = vi.fn(async (_files: File[]) => ({ status: 'ready' }))
		const router = mount(`/publisher?generation=${JOB}`, { loadModel })
		await waitFor(() => expect(loadModel).toHaveBeenCalledTimes(1))

		await act(() => router.revalidate())

		expect(loads).toBe(2)
		expect(loadModel).toHaveBeenCalledTimes(1)
	})

	it('opens again on a retry, after a failed open', async () => {
		// A body reads once, so every request gets a fresh one.
		let failing = true
		route = () => (failing ? refusal('runtime_unavailable', 503) : glb())
		const loadModel = vi.fn(async (_files: File[]) => ({ status: 'ready' }))
		mount(`/publisher?generation=${JOB}`, { loadModel })
		await waitFor(() =>
			expect(current().opening?.error).toBe('runtime_unavailable')
		)

		failing = false
		await act(async () => current().retryOpen())

		await waitFor(() => expect(loadModel).toHaveBeenCalledTimes(1))
		await waitFor(() => expect(current().opening).toBeNull())
	})

	it('reads as opening again while a retry downloads, not as the failure before it', async () => {
		route = () => refusal('runtime_unavailable', 503)
		mount(`/publisher?generation=${JOB}`)
		await waitFor(() =>
			expect(current().opening?.error).toBe('runtime_unavailable')
		)

		const held = heldArtifacts()
		await act(async () => current().retryOpen())
		await waitFor(() => expect(held.has(JOB)).toBe(true))

		expect(current().opening).toEqual({ jobId: JOB, error: null })
	})

	it('reads as opening again after the URL left a variant it opened and came back', async () => {
		route = () => glb()
		const router = mount(`/publisher?generation=${JOB}`)
		await waitFor(() => expect(current().opening).toBeNull())

		const held = heldArtifacts()
		await act(() => router.navigate('/publisher'))
		await act(() => router.navigate(`/publisher?generation=${JOB}`))
		await waitFor(() => expect(held.has(JOB)).toBe(true))

		expect(current().opening).toEqual({ jobId: JOB, error: null })
	})

	it('forgets a load that finished after the URL left it, so a revisit reads as opening', async () => {
		route = () => glb()
		let finishLoad: () => void = () => undefined
		const loadModel = vi.fn(
			() =>
				new Promise<{ status: string }>((resolve) => {
					finishLoad = () => resolve({ status: 'ready' })
				})
		)
		const router = mount(`/publisher?generation=${JOB}`, { loadModel })
		await waitFor(() => expect(loadModel).toHaveBeenCalledTimes(1))

		await act(() => router.navigate('/publisher'))
		await act(async () => finishLoad())
		const held = heldArtifacts()
		await act(() => router.navigate(`/publisher?generation=${JOB}`))
		await waitFor(() => expect(held.has(JOB)).toBe(true))

		expect(current().opening).toEqual({ jobId: JOB, error: null })
	})

	it('opens it again after the URL left it and came back', async () => {
		route = () => glb()
		const loadModel = vi.fn(async (_files: File[]) => ({ status: 'ready' }))
		const router = mount(`/publisher?generation=${JOB}`, { loadModel })
		await waitFor(() => expect(loadModel).toHaveBeenCalledTimes(1))

		await act(() => router.navigate('/publisher'))
		await act(() => router.navigate(`/publisher?generation=${JOB}`))

		await waitFor(() => expect(loadModel).toHaveBeenCalledTimes(2))
	})

	it('shows a download that failed by its kind', async () => {
		route = () => refusal('runtime_unavailable', 503)
		mount(`/publisher?generation=${JOB}`)

		await waitFor(() =>
			expect(current().opening).toEqual({
				jobId: JOB,
				error: 'runtime_unavailable'
			})
		)
		// Said aloud: the variant a link names may not be in the panel's list.
		expect(toastError).toHaveBeenCalledWith(
			'The generation runtime is not reachable. Trying again usually works.'
		)
	})

	it('shows a load the publisher refused as a failed open', async () => {
		route = () => glb()
		mount(`/publisher?generation=${JOB}`, {
			loadModel: async () => ({ status: 'error' })
		})

		await waitFor(() =>
			expect(current().opening).toEqual({ jobId: JOB, error: 'open_failed' })
		)
	})

	const image = () =>
		new File([new Uint8Array(1)], 'chair.png', { type: 'image/png' })
	const params = {
		resolution: 1024,
		textureSize: 2048,
		decimationTarget: 200_000,
		seedCount: 1
	} as const

	it('reloads the list once a submit is accepted, so the new batch is in it', async () => {
		route = () =>
			envelope(
				{
					batchId: 'batch',
					jobs: [{ jobId: JOB, seed: 7, status: 'queued', error: null }]
				},
				202
			)
		mount('/publisher')
		await waitFor(() => expect(latest).not.toBeNull())

		await act(() => current().generate(image(), params))

		expect(loads).toBe(2)
		expect(current().submitError).toBeNull()
		expect(current().isSubmitting).toBe(false)
	})

	it('names a refused submit by its kind, and reloads nothing', async () => {
		route = () => refusal('runtime_unavailable', 503)
		mount('/publisher')
		await waitFor(() => expect(latest).not.toBeNull())

		await act(() => current().generate(image(), params))

		expect(current().submitError).toBe('runtime_unavailable')
		expect(loads).toBe(1)
	})
})
