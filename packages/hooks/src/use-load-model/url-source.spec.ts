// @vitest-environment jsdom
/**
 * `load({ kind: 'url' })`: a model at a URL loads as the same file dropped
 * would, and its failures leave the page as a failed drop does.
 *
 * The fetch is stubbed at the global, so the real `fetchModelFiles` runs, and
 * the files loader is a fake that records what it was handed: what is under
 * test is the hook's wiring, not the parsers, which `file-loaders.spec.ts`
 * owns.
 */
import { act, renderHook } from '@testing-library/react'
import { ModelLoader } from '@vctrl/core/model-loader'
import { Object3D } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useLoadModel from './use-load-model'

import type { LoadContext } from './load-context'
import type { OperationProgress } from '@vctrl/core'

const GLB = new TextEncoder().encode('glTF\u0002\u0000\u0000\u0000rest')

const loader = vi.hoisted(() => ({
	received: [] as File[][],
	contexts: [] as LoadContext[],
	/** Held open after parsing starts, to read the bar mid-load. */
	parsing: null as Promise<void> | null
}))

/** Each loader's progress listener, as the hook registers it. */
const parserProgress = new Map<
	ModelLoader,
	(progress: OperationProgress) => void
>()
const reportParse = (context: LoadContext, progress: number) =>
	parserProgress.get(context.modelLoader)?.({ operation: 'parse', progress })

vi.mock('./file-loaders', () => ({
	loadModelFromFiles: async (files: File[], context: LoadContext) => {
		loader.received.push(files)
		loader.contexts.push(context)
		reportParse(context, 0)
		if (loader.parsing) await loader.parsing
		const loaded = {
			file: { model: new Object3D(), name: files[0].name, type: 'glb' }
		}
		context.publish(loaded as never)
		return loaded
	}
}))

beforeEach(() => {
	loader.received = []
	loader.contexts = []
	loader.parsing = null
	parserProgress.clear()
	vi.spyOn(ModelLoader.prototype, 'onProgress').mockImplementation(function (
		this: ModelLoader,
		cb
	) {
		parserProgress.set(this, cb)
	})
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

function stubFetch(
	answer: (url: string, init?: RequestInit) => Promise<Response>
) {
	const fetchMock = vi.fn((input: URL | string, init?: RequestInit) =>
		answer(String(input), init)
	)
	vi.stubGlobal('fetch', fetchMock)
	return fetchMock
}

/** A fetch that never answers on its own, and rejects when aborted. */
const pending = (_url: string, init?: RequestInit) =>
	new Promise<Response>((_, reject) => {
		// As a real fetch does: it rejects with the signal's reason, at once
		// when the signal is already aborted.
		if (init?.signal?.aborted) reject(init.signal.reason)
		init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
	})

describe("load({ kind: 'url' })", () => {
	it('loads the fetched file through the files path', async () => {
		stubFetch(async () => new Response(GLB))
		const { result } = renderHook(() => useLoadModel())

		const outcome = await act(() =>
			result.current.load({
				kind: 'url',
				url: 'https://cdn.example.com/m/chair.glb'
			})
		)

		expect(outcome.status).toBe('ready')
		expect(result.current.source).toBe('url')
		expect(loader.received[0].map((file) => file.name)).toEqual(['chair.glb'])
	})

	it('fills the bar with the download, then parsing carries on from there', async () => {
		stubFetch(
			async () =>
				new Response(GLB, {
					headers: { 'Content-Length': String(GLB.byteLength) }
				})
		)
		let release = () => {}
		loader.parsing = new Promise((resolve) => (release = resolve))
		const { result } = renderHook(() => useLoadModel())

		let done: Promise<unknown> = Promise.resolve()
		act(() => {
			done = result.current.load({ kind: 'url', url: 'https://a.com/m.glb' })
		})
		// Inside act, so the download's updates commit before the bar is read:
		// outside it React renders them on its own schedule, which a loaded run
		// can leave behind the wait returning.
		await act(async () => {
			await vi.waitFor(() => expect(loader.received).toHaveLength(1))
		})

		// The parser has just reported 0, and the bar does not run back.
		expect(result.current.progress).toBe(90)
		// And parsing fills the rest.
		act(() => reportParse(loader.contexts[0], 50))
		expect(result.current.progress).toBe(95)

		release()
		await act(() => done)
	})

	it("keeps a superseded load's parsing out of the newer load's bar", async () => {
		let release = () => {}
		loader.parsing = new Promise((resolve) => (release = resolve))
		const fetchMock = stubFetch(async (url, init) =>
			url.endsWith('first.glb') ? new Response(GLB) : pending(url, init)
		)
		const { result } = renderHook(() => useLoadModel())

		let first: Promise<unknown> = Promise.resolve()
		act(() => {
			first = result.current.load({
				kind: 'url',
				url: 'https://a.com/first.glb'
			})
		})
		await vi.waitFor(() => expect(loader.contexts).toHaveLength(1))
		act(() => {
			void result.current.load({ kind: 'url', url: 'https://a.com/second.glb' })
		})
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

		act(() => reportParse(loader.contexts[0], 80))

		expect(result.current.progress).toBe(0)
		release()
		await act(() => first)
	})

	it('aborts the fetch when a newer load starts', async () => {
		const fetchMock = stubFetch(pending)
		const { result } = renderHook(() => useLoadModel())

		let first: Promise<unknown> = Promise.resolve()
		act(() => {
			first = result.current.load({
				kind: 'url',
				url: 'https://a.com/slow.glb'
			})
		})
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
		const signal = fetchMock.mock.calls[0][1]?.signal

		await act(() =>
			result.current.load({ kind: 'files', files: [new File([GLB], 'b.glb')] })
		)

		expect(signal?.aborted).toBe(true)
		const outcome = (await first) as { stillCurrent: () => boolean }
		expect(outcome.stillCurrent()).toBe(false)
		expect(result.current.file?.name).toBe('b.glb')
	})

	it('resolves a load a newer one superseded as empty, and logs nothing', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		stubFetch(async (url, init) =>
			url.endsWith('slow.glb') ? pending(url, init) : new Response(GLB)
		)
		const { result } = renderHook(() => useLoadModel())

		let first: Promise<{ status: string }> = Promise.resolve({ status: '' })
		act(() => {
			first = result.current.load({
				kind: 'url',
				url: 'https://a.com/slow.glb'
			})
		})
		await act(() =>
			result.current.load({ kind: 'url', url: 'https://a.com/b.glb' })
		)

		expect((await first).status).toBe('empty')
		expect(consoleError).not.toHaveBeenCalled()
		expect(result.current.file?.name).toBe('b.glb')
	})

	it('still reports a parse failure that follows a late abort', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		stubFetch(async () => new Response(GLB))
		const controller = new AbortController()
		let fail = (_error: Error) => {}
		loader.parsing = new Promise((_, reject) => (fail = reject))
		const { result } = renderHook(() => useLoadModel())

		let loading: Promise<{ status: string }> = Promise.resolve({ status: '' })
		act(() => {
			loading = result.current.load({
				kind: 'url',
				url: 'https://a.com/broken.glb',
				init: { signal: controller.signal }
			})
		})
		await vi.waitFor(() => expect(loader.contexts).toHaveLength(1))
		controller.abort()
		await act(async () => {
			fail(new Error('not a valid glTF'))
			await loading
		})

		expect((await loading).status).toBe('error')
		expect(result.current.status).toBe('error')
	})

	it('aborts the fetch on reset', async () => {
		const fetchMock = stubFetch(pending)
		const { result } = renderHook(() => useLoadModel())

		act(() => {
			void result.current.load({ kind: 'url', url: 'https://a.com/slow.glb' })
		})
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
		act(() => result.current.reset())

		expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
	})

	it("aborts the fetch when the caller's own signal does", async () => {
		const fetchMock = stubFetch(pending)
		const controller = new AbortController()
		const { result } = renderHook(() => useLoadModel())

		act(() => {
			void result.current.load({
				kind: 'url',
				url: 'https://a.com/slow.glb',
				init: { signal: controller.signal, headers: { 'X-Key': 'k' } }
			})
		})
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
		const sent = fetchMock.mock.calls[0][1]
		expect(sent?.headers).toEqual({ 'X-Key': 'k' })

		controller.abort()
		expect(sent?.signal?.aborted).toBe(true)
	})

	it('treats an abort by the caller as a cancellation, not a failure', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		const fetchMock = stubFetch(async (url, init) =>
			url.endsWith('a.glb') ? new Response(GLB) : pending(url, init)
		)
		const controller = new AbortController()
		const { result } = renderHook(() => useLoadModel())
		await act(() =>
			result.current.load({ kind: 'url', url: 'https://a.com/a.glb' })
		)

		let cancelled: Promise<{ status: string }> = Promise.resolve({ status: '' })
		act(() => {
			cancelled = result.current.load({
				kind: 'url',
				url: 'https://a.com/slow.glb',
				init: { signal: controller.signal }
			})
		})
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
		await act(async () => {
			controller.abort()
			await cancelled
		})

		expect((await cancelled).status).toBe('empty')
		expect(result.current.status).toBe('ready')
		expect(result.current.file?.name).toBe('a.glb')
		expect(consoleError).not.toHaveBeenCalled()
	})

	it('resolves empty for a signal that was aborted before the load began', async () => {
		stubFetch(pending)
		const { result } = renderHook(() => useLoadModel())

		const outcome = await act(() =>
			result.current.load({
				kind: 'url',
				url: 'https://a.com/a.glb',
				init: { signal: AbortSignal.abort() }
			})
		)

		expect(outcome.status).toBe('empty')
		expect(result.current.status).toBe('empty')
	})

	it('stops listening to the caller signal once the fetch settles', async () => {
		stubFetch(async () => new Response(GLB))
		const controller = new AbortController()
		const remove = vi.spyOn(controller.signal, 'removeEventListener')
		const { result } = renderHook(() => useLoadModel())

		await act(() =>
			result.current.load({
				kind: 'url',
				url: 'https://a.com/a.glb',
				init: { signal: controller.signal }
			})
		)

		expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
	})

	it('keeps the model on screen when a link fails, and says why', async () => {
		stubFetch(async (url) =>
			url.endsWith('gone.glb')
				? new Response('missing', { status: 404 })
				: new Response(GLB)
		)
		const { result } = renderHook(() => useLoadModel())
		await act(() =>
			result.current.load({ kind: 'url', url: 'https://a.com/a.glb' })
		)

		const outcome = await act(() =>
			result.current.load({ kind: 'url', url: 'https://a.com/gone.glb' })
		)

		expect(outcome.status).toBe('error')
		expect(outcome.error).toMatchObject({
			code: 'url_http',
			source: 'remote-url',
			recoverable: false,
			context: { status: 404 }
		})
		expect(result.current.status).toBe('ready')
		expect(result.current.file?.name).toBe('a.glb')
	})

	it('reports a failed link as the state when nothing was on screen', async () => {
		stubFetch(async () => {
			throw new TypeError('Failed to fetch')
		})
		const { result } = renderHook(() => useLoadModel())

		await act(() =>
			result.current.load({ kind: 'url', url: 'https://no-cors.example/a.glb' })
		)

		expect(result.current.status).toBe('error')
		expect(result.current.error).toMatchObject({ code: 'url_unreachable' })
	})
})
