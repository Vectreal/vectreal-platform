// @vitest-environment jsdom
/**
 * `loadId` is what a viewer keys its framing on, so it must change with a load
 * and survive an optimization swap. If an optimization minted a new id, every
 * pass would reframe the camera; if a load kept the old one, a new model would
 * open with the previous model's framing.
 */
import { act, renderHook } from '@testing-library/react'
import { ModelLoader } from '@vctrl/core/model-loader'
import { Object3D } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import useLoadModel from './use-load-model'

import type { useOptimizeModel } from '../use-optimize-model'

/** Real loaders publish as soon as the model parses; some paths only return. */
const loader = vi.hoisted(() => ({ publishes: true }))

vi.mock('./scene-loaders', () => ({
	loadModelFromSceneData: async (
		_source: unknown,
		context: { publish: (loaded: unknown) => void }
	) => {
		const loaded = {
			file: { model: new Object3D(), name: 'scene.glb', type: 'glb' }
		}
		if (loader.publishes) context.publish(loaded)
		return loaded
	},
	loadModelFromServer: vi.fn()
}))

afterEach(() => {
	vi.restoreAllMocks()
	loader.publishes = true
})

const fakeOptimizer = {
	isReady: true,
	getModel: async () => new Uint8Array([1, 2, 3])
} as unknown as ReturnType<typeof useOptimizeModel>

const loadScene = (load: ReturnType<typeof useLoadModel>['load']) =>
	act(() => load({ kind: 'scene-data', sceneData: {} as never }))

const readyLoadId = (state: { status: string; loadId?: number }) => {
	expect(state.status).toBe('ready')
	return state.loadId
}

describe('loadId', () => {
	it('keeps the id when an optimization swaps in a new rendition', async () => {
		vi.spyOn(ModelLoader.prototype, 'loadToThreeJS').mockResolvedValue({
			scene: new Object3D(),
			animations: []
		} as never)
		const { result } = renderHook(() => useLoadModel(fakeOptimizer))

		await loadScene(result.current.load)
		const loadedId = readyLoadId(result.current)
		const loadedModel = result.current.file?.model

		await act(() => result.current.optimizer.applyOptimization())

		expect(result.current.file?.model).not.toBe(loadedModel)
		expect(readyLoadId(result.current)).toBe(loadedId)
	})

	it('drops a pass result that lands after a newer load', async () => {
		let finishPass: (value: unknown) => void = () => {}
		vi.spyOn(ModelLoader.prototype, 'loadToThreeJS').mockReturnValue(
			new Promise((resolve) => {
				finishPass = resolve
			}) as never
		)
		const { result } = renderHook(() => useLoadModel(fakeOptimizer))

		await loadScene(result.current.load)
		const pass = result.current.optimizer.applyOptimization()
		await loadScene(result.current.load)
		const newerModel = result.current.file?.model
		const newerId = readyLoadId(result.current)

		await act(async () => {
			finishPass({ scene: new Object3D(), animations: [] })
			await pass
		})

		expect(result.current.file?.model).toBe(newerModel)
		expect(readyLoadId(result.current)).toBe(newerId)
	})

	it.each([
		['publishes on parse', true],
		['only returns', false]
	])(
		'mints a new id for every load when the loader %s',
		async (_, publishes) => {
			loader.publishes = publishes
			const { result } = renderHook(() => useLoadModel())

			await loadScene(result.current.load)
			const firstId = readyLoadId(result.current)
			await loadScene(result.current.load)

			expect(readyLoadId(result.current)).not.toBe(firstId)
		}
	)
})
