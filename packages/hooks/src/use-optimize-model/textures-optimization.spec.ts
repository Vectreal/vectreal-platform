// @vitest-environment jsdom
/**
 * A partial texture pass is a result, and the report has to describe it.
 *
 * The core commits the textures that compressed and then throws, so a caller
 * can say some did not. The hook used to skip its report on any throw, so the
 * savings of a pass that did apply stayed missing from it.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import useOptimizeModel from './use-optimize-model'

const { optimizer, TextureCompressionError } = vi.hoisted(() => {
	class TextureCompressionError extends Error {
		constructor(
			readonly failed: number,
			readonly total: number
		) {
			super(`${failed} of ${total} failed`)
		}
		get isPartial() {
			return this.failed < this.total
		}
	}
	return {
		TextureCompressionError,
		optimizer: {
			compressTextures: vi.fn(),
			getReport: vi.fn()
		}
	}
})

vi.mock('@vctrl/core/model-optimizer', () => ({
	SupersededError: class extends Error {},
	TextureCompressionError,
	ModelOptimizer: class {
		hasModel = () => true
		reset = () => {}
		compressTextures = optimizer.compressTextures
		getReport = optimizer.getReport
	}
}))

const report = (marker: string) => ({
	marker,
	appliedOptimizations: [],
	optimizedSize: 0,
	stats: Object.fromEntries(
		[
			'verticesCount',
			'primitivesCount',
			'meshesCount',
			'texturesCount',
			'materialsCount'
		].map((key) => [key, { before: 0, after: 0 }])
	)
})

describe('useOptimizeModel texturesOptimization', () => {
	it('reports what a partial pass committed, and still says it was partial', async () => {
		const partial = new TextureCompressionError(1, 3)
		optimizer.compressTextures.mockRejectedValueOnce(partial)
		optimizer.getReport.mockResolvedValueOnce(report('after the partial pass'))
		const { result } = renderHook(() => useOptimizeModel())

		await act(() =>
			expect(
				result.current.texturesOptimization({ targetFormat: 'webp' })
			).rejects.toBe(partial)
		)

		expect(result.current.report).toMatchObject({
			marker: 'after the partial pass'
		})
	})

	it('keeps the error it owes when the report itself fails', async () => {
		const partial = new TextureCompressionError(1, 3)
		optimizer.compressTextures.mockRejectedValueOnce(partial)
		optimizer.getReport.mockRejectedValueOnce(new Error('report failed'))
		const { result } = renderHook(() => useOptimizeModel())

		await act(() =>
			expect(
				result.current.texturesOptimization({ targetFormat: 'webp' })
			).rejects.toBe(partial)
		)
	})

	it('reports nothing for a pass that changed nothing', async () => {
		optimizer.getReport.mockClear()
		optimizer.compressTextures.mockRejectedValueOnce(
			new TextureCompressionError(3, 3)
		)
		const { result } = renderHook(() => useOptimizeModel())

		await act(() =>
			expect(
				result.current.texturesOptimization({ targetFormat: 'webp' })
			).rejects.toBeInstanceOf(TextureCompressionError)
		)

		expect(optimizer.getReport).not.toHaveBeenCalled()
	})
})
