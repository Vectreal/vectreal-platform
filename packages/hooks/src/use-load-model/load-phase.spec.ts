// @vitest-environment jsdom
/**
 * A load says where it is: `fetching` with bytes, then `parsing` with the
 * files the parse has loaded.
 *
 * The fetch is stubbed at the global, so the real `fetchModelFiles` runs; the
 * files loader is a fake that reports as the real parser does, through the
 * load's own `ModelLoader`.
 *
 * Mutation gates, executed:
 *  - drop `phase: 'parsing'` from the parser listener in `useLoadModel` and
 *    `moves to parsing ...` goes red;
 *  - drop `onBytes` from the `fetchModelFiles` call and
 *    `reports the download's bytes ...` goes red;
 *  - drop `expectedBytes` from the same call and the total reads null there;
 *  - return `fetching` for every source from `initialLoadPhase` and both
 *    `starts ... in parsing` tests go red.
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
	contexts: [] as LoadContext[],
	/** Held before the parser's first report, to read the phase a load starts in. */
	starting: null as Promise<void> | null,
	parsing: null as Promise<void> | null
}))

const parserProgress = new Map<
	ModelLoader,
	(progress: OperationProgress) => void
>()
const report = (context: LoadContext, progress: OperationProgress) =>
	parserProgress.get(context.modelLoader)?.(progress)

vi.mock('./file-loaders', () => ({
	loadModelFromFiles: async (files: File[], context: LoadContext) => {
		loader.contexts.push(context)
		if (loader.starting) await loader.starting
		report(context, { operation: 'parse', progress: 0 })
		if (loader.parsing) await loader.parsing
		const loaded = {
			file: { model: new Object3D(), name: files[0].name, type: 'glb' }
		}
		context.publish(loaded as never)
		return loaded
	}
}))

beforeEach(() => {
	loader.contexts = []
	loader.starting = null
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

/** A response whose body arrives when the test says so. */
function heldResponse() {
	let stream!: ReadableStreamDefaultController<Uint8Array>
	const body = new ReadableStream<Uint8Array>({
		start: (controller) => {
			stream = controller
		}
	})
	return {
		response: new Response(body),
		send: (bytes: Uint8Array) => stream.enqueue(bytes),
		end: () => stream.close()
	}
}

describe('load phases', () => {
	it("reports the download's bytes against the caller's size, then moves to parsing", async () => {
		const held = heldResponse()
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => held.response)
		)
		let release = () => {}
		loader.parsing = new Promise((resolve) => (release = resolve))
		const { result } = renderHook(() => useLoadModel())

		let done: Promise<unknown> = Promise.resolve()
		act(() => {
			done = result.current.load({
				kind: 'url',
				url: 'https://a.com/m.glb',
				expectedBytes: 100
			})
		})
		expect(result.current.status === 'loading' && result.current.phase).toBe(
			'fetching'
		)

		// State set inside `act` commits when it ends, so read it after.
		await act(async () => {
			held.send(GLB.slice(0, 4))
			await new Promise((resolve) => setTimeout(resolve, 10))
		})
		const fetching = result.current
		expect(fetching.status === 'loading' && fetching.bytes).toEqual({
			loaded: 4,
			total: 100
		})

		await act(async () => {
			held.send(GLB.slice(4))
			held.end()
			await vi.waitFor(() => expect(loader.contexts).toHaveLength(1))
		})

		const parsing = result.current
		expect(parsing.status === 'loading' && parsing.phase).toBe('parsing')
		// The download is over, so its bytes go with it.
		expect(parsing.status === 'loading' && parsing.bytes).toBeUndefined()

		act(() =>
			report(loader.contexts[0], {
				operation: 'files',
				progress: 25,
				items: { loaded: 2, total: 5 }
			})
		)
		const counted = result.current
		expect(counted.status === 'loading' && counted.items).toEqual({
			loaded: 2,
			total: 5
		})

		release()
		await act(() => done)
		expect(result.current.status).toBe('ready')
	})

	it('starts a picked file in parsing: there is nothing to fetch', async () => {
		let release = () => {}
		loader.starting = new Promise((resolve) => (release = resolve))
		const { result } = renderHook(() => useLoadModel())

		let done: Promise<unknown> = Promise.resolve()
		act(() => {
			done = result.current.load({
				kind: 'files',
				files: [new File([GLB], 'chair.glb')]
			})
		})

		const state = result.current
		expect(state.status === 'loading' && state.phase).toBe('parsing')

		release()
		await act(() => done)
	})
	it('starts a scene payload that carries its assets in parsing', async () => {
		vi.stubGlobal('fetch', vi.fn())
		const { result } = renderHook(() => useLoadModel())

		act(() => {
			void result.current.load({
				kind: 'scene-data',
				sceneData: { gltfJson: { asset: { version: '2.0' } }, assetData: {} }
			} as never)
		})

		const state = result.current
		expect(state.status === 'loading' && state.phase).toBe('parsing')
	})
})
