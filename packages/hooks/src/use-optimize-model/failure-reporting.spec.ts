// @vitest-environment jsdom
/**
 * A failure is reported as one: never as the null that means "no model", and
 * never by leaving the optimizer loading with no error to show for it.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import useOptimizeModel from './use-optimize-model'

import type { ServerSceneData } from '@vctrl/core'

const optimizer = vi.hoisted(() => ({
	hasModel: true,
	export: vi.fn<() => Promise<Uint8Array>>()
}))

vi.mock('@vctrl/core/model-optimizer', () => ({
	SupersededError: class extends Error {},
	TextureCompressionError: class extends Error {},
	ModelOptimizer: class {
		hasModel = () => optimizer.hasModel
		reset = () => {}
		export = optimizer.export
	}
}))

afterEach(() => {
	vi.clearAllMocks()
	vi.restoreAllMocks()
})

describe('useOptimizeModel getModel', () => {
	it('rejects with the export error when a loaded model cannot be written', async () => {
		optimizer.hasModel = true
		const failure = new Error('writeBinary failed')
		optimizer.export.mockRejectedValueOnce(failure)
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const { result } = renderHook(() => useOptimizeModel())

		await expect(result.current.getModel()).rejects.toBe(failure)
	})

	it('resolves null only when no model is loaded', async () => {
		optimizer.hasModel = false
		const { result } = renderHook(() => useOptimizeModel())

		await expect(result.current.getModel()).resolves.toBeNull()
		expect(optimizer.export).not.toHaveBeenCalled()
	})
})

describe('useOptimizeModel loadFromServerSceneData', () => {
	it('ends the load with an error when the scene has no glTF document', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const { result } = renderHook(() => useOptimizeModel())
		const published = { gltfJson: null } as unknown as ServerSceneData

		await act(async () => {
			await expect(
				result.current.loadFromServerSceneData(published)
			).rejects.toThrow('no glTF document')
		})

		expect(result.current.loading).toBe(false)
		expect(result.current.error?.message).toMatch('no glTF document')
	})
})
