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
	({ isReady: true, getModel }) as unknown as ReturnType<
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
			'No model was loaded when this optimizer was read.'
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
})
