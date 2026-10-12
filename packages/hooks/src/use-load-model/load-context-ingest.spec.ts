// @vitest-environment jsdom
/**
 * The loaders reach the optimizer only through `LoadContext.mayIngest`, which
 * asks whether this load's model is the one on screen. Not "is it the newest
 * load": a newer drop that fails puts the earlier model back, which must still
 * reach the optimizer, while a load retired before it published never may.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import useLoadModel from './use-load-model'

import type { LoadContext } from './load-context'
import type { LoadedModel } from './types'

const contexts = vi.hoisted(() => [] as LoadContext[])
const parsed = vi.hoisted(
	() => (name: string) =>
		({ file: { model: {}, name, type: 'glb' } }) as unknown as LoadedModel
)

vi.mock('@vctrl/core/model-loader', async (importOriginal) => ({
	...(await importOriginal<object>()),
	ModelLoader: class {
		onProgress = () => {}
	}
}))

// A file named `bad` fails to parse; every other load but a `.ready` one
// stays in flight.
vi.mock('./file-loaders', () => ({
	loadModelFromFiles: (files: File[], ctx: LoadContext) => {
		contexts.push(ctx)
		const [{ name }] = files
		if (name === 'bad') return Promise.reject(new Error('unreadable'))
		// A `.ready` file publishes and finishes, so its outcome can be held.
		if (name.endsWith('.ready')) {
			ctx.publish(parsed(name))
			return Promise.resolve(parsed(name))
		}
		return new Promise(() => {})
	}
}))

// A scene source that fails replaces the model with an error, not the last one.
vi.mock('./scene-loaders', () => ({
	loadModelFromSceneData: () => Promise.reject(new Error('missing scene')),
	loadModelFromServer: () => Promise.reject(new Error('missing scene'))
}))

function setup(optimizer?: Parameters<typeof useLoadModel>[0]) {
	const { result } = renderHook(() => useLoadModel(optimizer))
	const start = async (name: string) => {
		await act(async () => {
			void result.current
				.load({ kind: 'files', files: [new File([], name)] })
				.catch(() => {})
		})
		return contexts[contexts.length - 1]
	}
	const publish = (ctx: LoadContext, name: string) =>
		act(() => ctx.publish(parsed(name)))
	return { result, start, publish }
}

beforeEach(() => {
	contexts.length = 0
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('LoadContext.mayIngest', () => {
	it('lets a load ingest once its model is on screen', async () => {
		const { start, publish } = setup()
		const a = await start('a.glb')
		expect(a.mayIngest()).toBe(false)
		publish(a, 'a.glb')
		expect(a.mayIngest()).toBe(true)
	})

	it('never lets a load retired before it published ingest', async () => {
		const { start, publish } = setup()
		const a = await start('a.glb')
		publish(a, 'a.glb')
		const b = await start('b.glb')
		await start('c.glb')
		publish(b, 'b.glb')

		expect(b.mayIngest()).toBe(false)
	})

	it('hands ingest back to the model a failed newer drop left on screen', async () => {
		const { start, publish } = setup()
		const a = await start('a.glb')
		publish(a, 'a.glb')
		await start('bad')

		expect(a.mayIngest()).toBe(true)
	})

	it('refuses a load once a newer model is on screen', async () => {
		const { start, publish } = setup()
		const a = await start('a.glb')
		publish(a, 'a.glb')
		const b = await start('b.glb')
		publish(b, 'b.glb')

		expect(a.mayIngest()).toBe(false)
		expect(b.mayIngest()).toBe(true)
	})

	it('refuses every load after a reset', async () => {
		const { result, start, publish } = setup()
		const a = await start('a.glb')
		publish(a, 'a.glb')
		act(() => result.current.reset())

		expect(a.mayIngest()).toBe(false)
	})

	it('refuses every load once a failed scene left nothing on screen', async () => {
		const { result, start, publish } = setup()
		const a = await start('a.glb')
		publish(a, 'a.glb')
		await act(async () => {
			await result.current.load({
				kind: 'scene-data',
				sceneData: {} as never
			})
		})

		expect(a.mayIngest()).toBe(false)
	})

	// The draft restore states its original only for a model still on screen.
	it('answers the outcome by what is on screen, not by which load is newest', async () => {
		const { result, start } = setup()
		let outcome: Awaited<ReturnType<typeof result.current.load>> | undefined
		await act(async () => {
			outcome = await result.current.load({
				kind: 'files',
				files: [new File([], 'a.ready')]
			})
		})
		await start('bad')

		expect(outcome?.stillCurrent()).toBe(false)
		expect(outcome?.stillOnScreen()).toBe(true)

		await start('b.ready')
		expect(outcome?.stillOnScreen()).toBe(false)
	})
})

/*
  The optimizer may hold the on-screen model or none, so it is released when
  another model reaches the screen, not when an ingest gets as far as claiming
  it: a read that fails first would otherwise leave the previous document.
*/
describe('the optimizer while the screen changes', () => {
	const setupWithOptimizer = () => {
		const reset = vi.fn()
		const optimizer = { reset, isReady: false } as unknown as Parameters<
			typeof useLoadModel
		>[0]
		return { reset, ...setup(optimizer) }
	}

	it('is released when a newer model reaches the screen, before any ingest', async () => {
		const { reset, start, publish } = setupWithOptimizer()
		const a = await start('a.glb')
		publish(a, 'a.glb')
		reset.mockClear()
		const b = await start('b.glb')
		expect(reset).not.toHaveBeenCalled()

		publish(b, 'b.glb')
		expect(reset).toHaveBeenCalledTimes(1)
	})

	it('keeps the model a failed newer drop left on screen', async () => {
		const { reset, start, publish } = setupWithOptimizer()
		const a = await start('a.glb')
		publish(a, 'a.glb')
		reset.mockClear()
		await start('bad')

		expect(reset).not.toHaveBeenCalled()
	})

	it('is released once a failed scene left nothing on screen', async () => {
		const { result, reset, start, publish } = setupWithOptimizer()
		const a = await start('a.glb')
		publish(a, 'a.glb')
		reset.mockClear()
		let failed: Awaited<ReturnType<typeof result.current.load>> | undefined
		await act(async () => {
			failed = await result.current.load({
				kind: 'scene-data',
				sceneData: {} as never
			})
		})

		expect(reset).toHaveBeenCalledTimes(1)
		// Nothing, not the failed scene, is what the optimizer may now hold.
		expect(failed?.stillOnScreen()).toBe(false)
	})

	it('is released when the model is cleared', async () => {
		const { result, reset, start, publish } = setupWithOptimizer()
		const a = await start('a.glb')
		publish(a, 'a.glb')
		reset.mockClear()
		act(() => result.current.reset())

		expect(reset).toHaveBeenCalledTimes(1)
	})
})
