// @vitest-environment jsdom
/**
 * `applyOptimization` says when it did not do what it was asked. It used to
 * catch and log every failure and resolve, so the publisher reported a pass
 * whose result never reached the viewer as a success.
 */
import { act, renderHook } from '@testing-library/react'
import { ModelLoader } from '@vctrl/core/model-loader'
import {
	SupersededError,
	TextureCompressionError
} from '@vctrl/core/model-optimizer'
import { Object3D } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import useLoadModel from './use-load-model'

import type { useOptimizeModel } from '../use-optimize-model'

vi.mock('./scene-loaders', () => ({
	loadModelFromSceneData: async (
		_source: unknown,
		context: { publish: (loaded: unknown) => void }
	) => {
		const loaded = {
			file: { model: new Object3D(), name: 'scene.glb', type: 'glb' }
		}
		context.publish(loaded)
		return loaded
	},
	loadModelFromServer: vi.fn()
}))

afterEach(() => {
	vi.restoreAllMocks()
})

const optimizer = (
	getModel: () => Promise<Uint8Array | null> = async () =>
		new Uint8Array([1, 2, 3])
) =>
	({ isReady: true, reset: () => {}, getModel }) as unknown as ReturnType<
		typeof useOptimizeModel
	>

const parse = () =>
	vi.spyOn(ModelLoader.prototype, 'loadToThreeJS').mockResolvedValue({
		scene: new Object3D(),
		animations: []
	} as never)

async function loaded(instance = optimizer()) {
	const { result } = renderHook(() => useLoadModel(instance))
	await act(() =>
		result.current.load({ kind: 'scene-data', sceneData: {} as never })
	)
	return result
}

const failingWith = (error: unknown) => async () => {
	throw error
}

describe('applyOptimization', () => {
	it('refuses before any model is loaded', async () => {
		const { result } = renderHook(() => useLoadModel(optimizer()))

		await expect(result.current.optimizer.applyOptimization()).rejects.toThrow(
			'No model was ready when this optimizer was read.'
		)
	})

	// Its own error, unwrapped, so the publisher still recognises a
	// superseded pass and stays quiet about it.
	it('rejects with the optimization’s own error and shows nothing', async () => {
		const shown = parse()
		const result = await loaded()
		const superseded = new SupersededError()

		await expect(
			result.current.optimizer.applyOptimization(failingWith(superseded))
		).rejects.toBe(superseded)
		expect(shown).not.toHaveBeenCalled()
	})

	it('rejects when the optimized model cannot be exported', async () => {
		const result = await loaded(optimizer(async () => null))

		await expect(result.current.optimizer.applyOptimization()).rejects.toThrow(
			'No optimized model could be exported.'
		)
	})

	it('rejects with the export error as the cause when the export fails', async () => {
		const writeError = new Error('writeBinary: invalid accessor')
		const result = await loaded(
			optimizer(async () => {
				throw writeError
			})
		)

		await expect(
			result.current.optimizer.applyOptimization()
		).rejects.toMatchObject({
			message: 'No optimized model could be exported.',
			cause: writeError
		})
	})

	it('rejects when the optimized model cannot be shown', async () => {
		const parseError = new Error('not a GLB')
		vi.spyOn(ModelLoader.prototype, 'loadToThreeJS').mockRejectedValue(
			parseError
		)
		const result = await loaded()

		await expect(
			result.current.optimizer.applyOptimization()
		).rejects.toMatchObject({
			message: 'The optimized model could not be shown.',
			cause: parseError
		})
	})

	// The textures that compressed are in the document, so the viewer has to
	// show them for the two to agree.
	it('shows what a partial texture pass committed, then rejects with it', async () => {
		parse()
		const result = await loaded()
		const onScreen = result.current.file?.model
		const partial = new TextureCompressionError(1, 3, '1 of 3 failed')

		await act(() =>
			expect(
				result.current.optimizer.applyOptimization(failingWith(partial))
			).rejects.toBe(partial)
		)
		expect(result.current.file?.model).not.toBe(onScreen)
	})

	it('shows nothing when no texture compressed', async () => {
		const shown = parse()
		const result = await loaded()
		const total = new TextureCompressionError(3, 3, '3 of 3 failed')

		await expect(
			result.current.optimizer.applyOptimization(failingWith(total))
		).rejects.toBe(total)
		expect(shown).not.toHaveBeenCalled()
	})

	// A failed pass gives up on a slow sync and asks for the original; the
	// abandoned sync landing afterwards would put the failed result back.
	it('lets only the sync that read last reach the viewer', async () => {
		const abandoned = new Object3D()
		const original = new Object3D()
		let finishAbandoned: (scene: Object3D) => void = () => {}
		vi.spyOn(ModelLoader.prototype, 'loadToThreeJS')
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finishAbandoned = (scene) =>
							resolve({ scene, animations: [] } as never)
					})
			)
			.mockResolvedValueOnce({ scene: original, animations: [] } as never)
		const result = await loaded()

		const first = result.current.optimizer.applyOptimization()
		await act(() => result.current.optimizer.applyOptimization())
		expect(result.current.file?.model).toBe(original)

		finishAbandoned(abandoned)
		await act(() => expect(first).rejects.toBeInstanceOf(SupersededError))
		expect(result.current.file?.model).toBe(original)
	})

	// A call that runs a step reads the document after the step, so it shows
	// a newer document than a call that read while the step ran.
	it('lets a call that read after its step outrank one made during it', async () => {
		const shown = parse()
		const result = await loaded()
		let finishStep: () => void = () => {}
		const step = () =>
			new Promise<void>((resolve) => {
				finishStep = resolve
			})

		const withStep = result.current.optimizer.applyOptimization(step)
		await act(() => result.current.optimizer.applyOptimization())
		finishStep()

		await act(() => withStep)
		expect(shown).toHaveBeenCalledTimes(2)
	})

	// The read is the claim: an export that finishes late still describes the
	// document as it was when the call asked for it.
	it('refuses a call whose read finished after a later call read', async () => {
		const scenes = new Map([
			[1, new Object3D()],
			[2, new Object3D()]
		])
		vi.spyOn(ModelLoader.prototype, 'loadToThreeJS').mockImplementation(
			async (file) =>
				({ scene: scenes.get((file as File).size), animations: [] }) as never
		)
		let finishFirstRead: () => void = () => {}
		const getModel = vi
			.fn<() => Promise<Uint8Array | null>>()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finishFirstRead = () => resolve(new Uint8Array([1]))
					})
			)
			.mockResolvedValueOnce(new Uint8Array([1, 2]))
		const result = await loaded(optimizer(getModel))

		const first = result.current.optimizer.applyOptimization()
		await act(() => result.current.optimizer.applyOptimization())
		finishFirstRead()

		await act(() => expect(first).rejects.toBeInstanceOf(SupersededError))
		expect(result.current.file?.model).toBe(scenes.get(2))
	})
})
