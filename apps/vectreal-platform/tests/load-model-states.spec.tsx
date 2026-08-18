// @vitest-environment jsdom
/**
 * The loader's state is the load.
 *
 * Every one of these cases used to leave `isFileLoading` true forever, because
 * the flag was raised at the top of `load()` and each of these paths returned
 * before the line that lowered it. The publisher rendered that as a spinner
 * that never resolved. The point of the state union is that there is no flag
 * left to strand: a load ends in `ready` or `error`, never in between.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { useLoadModel } from '@vctrl/hooks/use-load-model'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@vctrl/core/model-loader', async () => {
	const actual = await vi.importActual<
		typeof import('@vctrl/core/model-loader')
	>('@vctrl/core/model-loader')

	return {
		...actual,
		ModelLoader: class {
			onProgress() {}
			async loadToThreeJS() {
				return { scene: { name: 'scene' } }
			}
			async loadGLTFWithAssetsToThreeJS() {
				return { scene: { name: 'scene' } }
			}
		}
	}
})

const file = (name: string) =>
	new File([new Uint8Array([1, 2, 3])], name, { type: 'model/gltf-binary' })

describe('useLoadModel state', () => {
	it('starts empty', () => {
		const { result } = renderHook(() => useLoadModel())

		expect(result.current.status).toBe('empty')
		expect(result.current.file).toBeNull()
	})

	it('reports an empty file list as an error rather than loading forever', async () => {
		const { result } = renderHook(() => useLoadModel())

		const state = await act(() =>
			result.current.load({ kind: 'files', files: [] })
		)

		expect(state.status).toBe('error')
		expect(state.error?.code).toBe('unsupported_format')
		await waitFor(() => expect(result.current.status).toBe('error'))
	})

	it('rejects a folder holding more than one model, and says which', async () => {
		const { result } = renderHook(() => useLoadModel())

		const state = await act(() =>
			result.current.load({
				kind: 'files',
				files: [file('a.gltf'), file('b.glb')]
			})
		)

		expect(state.status).toBe('error')
		expect(state.error?.code).toBe('multiple_models')
		expect(state.error?.message).toContain('a.gltf')
	})

	it('reports unsupported files as an error', async () => {
		const { result } = renderHook(() => useLoadModel())

		const state = await act(() =>
			result.current.load({ kind: 'files', files: [file('notes.txt')] })
		)

		expect(state.status).toBe('error')
		expect(state.error?.code).toBe('unsupported_format')
	})

	it('surfaces a model, and keeps status and file in agreement', async () => {
		const { result } = renderHook(() => useLoadModel())

		const state = await act(() =>
			result.current.load({ kind: 'files', files: [file('model.glb')] })
		)

		expect(state.status).toBe('ready')
		expect(state.file?.name).toBe('model.glb')
		await waitFor(() => {
			expect(result.current.status).toBe('ready')
			expect(result.current.file).not.toBeNull()
		})
	})

	it('does not report the previous model after a failed load', async () => {
		const { result } = renderHook(() => useLoadModel())

		await act(() =>
			result.current.load({ kind: 'files', files: [file('model.glb')] })
		)
		const failed = await act(() =>
			result.current.load({ kind: 'files', files: [file('notes.txt')] })
		)

		expect(failed.status).toBe('error')
		expect(failed.file).toBeNull()
		await waitFor(() => expect(result.current.file).toBeNull())
	})

	it('clears the model on reset', async () => {
		const { result } = renderHook(() => useLoadModel())

		await act(() =>
			result.current.load({ kind: 'files', files: [file('model.glb')] })
		)
		act(() => result.current.reset())

		await waitFor(() => expect(result.current.status).toBe('empty'))
	})
})
