// @vitest-environment jsdom
/**
 * `useSrcModel`: what `<VectrealViewer src>` draws, and when it stops caring.
 *
 * The loader is a fake that records each call and its signal, and resolves when
 * told to: what is under test is which load may write, not the parsers, which
 * `fetch-model-files.spec.ts` and the loader's own specs own.
 */
import { act, renderHook } from '@testing-library/react'
import { Object3D } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSrcModel } from './use-src-model'

import type { SrcLoadOptions, SrcModel } from '../load-src'

interface Call {
	src: string
	options: SrcLoadOptions
	resolve: (model: SrcModel) => void
	reject: (error: unknown) => void
}

const calls = vi.hoisted(() => [] as Call[])

vi.mock('../load-src', () => ({
	loadSrcModel: (src: string, options: SrcLoadOptions) =>
		new Promise<SrcModel>((resolve, reject) =>
			calls.push({ src, options, resolve, reject })
		)
}))

afterEach(() => {
	calls.length = 0
})

const modelNamed = (name: string): SrcModel => {
	const model = new Object3D()
	model.name = name
	return { model, animations: [] }
}

/** The dynamic import and the fake's promise both settle on a microtask. */
const settle = () => act(async () => {})

describe('useSrcModel', () => {
	it('loads the address and hands the model over', async () => {
		const onLoad = vi.fn()
		const { result } = renderHook(() =>
			useSrcModel('https://cdn.example.com/a.glb', {}, { onLoad })
		)
		await vi.waitFor(() => expect(calls).toHaveLength(1))
		expect(result.current.status).toBe('loading')

		const loaded = modelNamed('a')
		calls[0].resolve(loaded)
		await settle()

		expect(result.current).toMatchObject({
			status: 'ready',
			model: loaded.model
		})
		expect(onLoad).toHaveBeenCalledWith(loaded)
	})

	it('loads nothing without an address, which is how `model` switches it off', async () => {
		const { result } = renderHook(() => useSrcModel(null))
		await settle()

		expect(result.current.status).toBe('idle')
		expect(calls).toHaveLength(0)
	})

	it('reports a load that failed', async () => {
		const onLoadError = vi.fn()
		const { result } = renderHook(() =>
			useSrcModel('https://a.com/gone.glb', {}, { onLoadError })
		)
		await vi.waitFor(() => expect(calls).toHaveLength(1))

		const error = new Error('answered 404')
		calls[0].reject(error)
		await settle()

		expect(result.current).toMatchObject({ status: 'error', error })
		expect(onLoadError).toHaveBeenCalledWith(error)
	})

	it('drops the old address for a new one, and its late answer with it', async () => {
		const onLoad = vi.fn()
		const { result, rerender } = renderHook(
			({ src }) => useSrcModel(src, {}, { onLoad }),
			{ initialProps: { src: 'https://a.com/first.glb' } }
		)
		await vi.waitFor(() => expect(calls).toHaveLength(1))

		rerender({ src: 'https://a.com/second.glb' })
		await vi.waitFor(() => expect(calls).toHaveLength(2))
		expect(calls[0].options.init?.signal?.aborted).toBe(true)

		calls[0].resolve(modelNamed('first'))
		const second = modelNamed('second')
		calls[1].resolve(second)
		await settle()

		expect(result.current.model).toBe(second.model)
		expect(onLoad).toHaveBeenCalledTimes(1)
		expect(onLoad).toHaveBeenCalledWith(second)
	})

	it('ignores a failure from an address it has moved past', async () => {
		const onLoadError = vi.fn()
		const { result, rerender } = renderHook(
			({ src }) => useSrcModel(src, {}, { onLoadError }),
			{ initialProps: { src: 'https://a.com/first.glb' } }
		)
		await vi.waitFor(() => expect(calls).toHaveLength(1))
		rerender({ src: 'https://a.com/second.glb' })
		await vi.waitFor(() => expect(calls).toHaveLength(2))

		const second = modelNamed('second')
		calls[1].resolve(second)
		calls[0].reject(new DOMException('aborted', 'AbortError'))
		await settle()

		expect(result.current).toMatchObject({
			status: 'ready',
			model: second.model
		})
		expect(onLoadError).not.toHaveBeenCalled()
	})

	it('does not load again for a new options object at the same address', async () => {
		const { rerender } = renderHook(
			({ options }) => useSrcModel('https://a.com/a.glb', options),
			{ initialProps: { options: {} as SrcLoadOptions } }
		)
		await vi.waitFor(() => expect(calls).toHaveLength(1))

		rerender({ options: { dracoDecoderPath: '/draco/' } })
		await settle()

		expect(calls).toHaveLength(1)
	})

	it('passes its options through, with a signal of its own', async () => {
		renderHook(() =>
			useSrcModel('https://a.com/a.glb', {
				init: { headers: { 'X-Key': 'k' } },
				dracoDecoderPath: '/decoders/draco/'
			})
		)
		await vi.waitFor(() => expect(calls).toHaveLength(1))

		expect(calls[0].options).toMatchObject({
			dracoDecoderPath: '/decoders/draco/',
			init: { headers: { 'X-Key': 'k' } }
		})
		expect(calls[0].options.init?.signal).toBeInstanceOf(AbortSignal)
	})

	it("aborts with the caller's own signal, and stops listening when done", async () => {
		const controller = new AbortController()
		const remove = vi.spyOn(controller.signal, 'removeEventListener')
		const { unmount } = renderHook(() =>
			useSrcModel('https://a.com/a.glb', {
				init: { signal: controller.signal }
			})
		)
		await vi.waitFor(() => expect(calls).toHaveLength(1))

		controller.abort()
		expect(calls[0].options.init?.signal?.aborted).toBe(true)

		unmount()
		expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
	})

	it("fails a load the caller's own signal aborted, rather than waiting on it", async () => {
		const controller = new AbortController()
		const onLoadError = vi.fn()
		const { result } = renderHook(() =>
			useSrcModel(
				'https://a.com/a.glb',
				{ init: { signal: controller.signal } },
				{ onLoadError }
			)
		)
		await vi.waitFor(() => expect(calls).toHaveLength(1))

		const reason = new DOMException('timed out', 'TimeoutError')
		controller.abort(reason)
		calls[0].reject(calls[0].options.init?.signal?.reason)
		await settle()

		expect(result.current).toMatchObject({ status: 'error', error: reason })
		expect(onLoadError).toHaveBeenCalledWith(reason)
	})

	it('aborts when the viewer unmounts', async () => {
		const { unmount } = renderHook(() => useSrcModel('https://a.com/a.glb'))
		await vi.waitFor(() => expect(calls).toHaveLength(1))

		unmount()

		expect(calls[0].options.init?.signal?.aborted).toBe(true)
	})
})
