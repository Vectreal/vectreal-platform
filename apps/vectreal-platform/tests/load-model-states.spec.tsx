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

/*
  Holds one named file inside the loader so a third load can start while it is
  still in flight. Hoisted because the module mock below is.
*/
const inFlight = vi.hoisted(() => {
	let release = () => {}
	const parked = new Promise<void>((resolve) => {
		release = resolve
	})
	return { blocks: 'slow.glb', parked, release: () => release() }
})

vi.mock('@vctrl/core/model-loader', async () => {
	const actual = await vi.importActual<
		typeof import('@vctrl/core/model-loader')
	>('@vctrl/core/model-loader')

	return {
		...actual,
		ModelLoader: class {
			onProgress() {}
			async loadToThreeJS(file: File) {
				if (file?.name === inFlight.blocks) await inFlight.parked
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

	it('reports the failure without reporting the previous model as loaded', async () => {
		const { result } = renderHook(() => useLoadModel())

		await act(() =>
			result.current.load({ kind: 'files', files: [file('model.glb')] })
		)
		const failed = await act(() =>
			result.current.load({ kind: 'files', files: [file('notes.txt')] })
		)

		expect(failed.status).toBe('error')
		expect(failed.file).toBeNull()
	})

	it('leaves the model that was on screen alone when an upload fails', async () => {
		const { result } = renderHook(() => useLoadModel())

		await act(() =>
			result.current.load({ kind: 'files', files: [file('model.glb')] })
		)
		await act(() =>
			result.current.load({ kind: 'files', files: [file('notes.txt')] })
		)

		// Dropping the wrong file onto an open scene must not cost the user the
		// model, and everything the app hangs off it, that was already there.
		await waitFor(() => {
			expect(result.current.status).toBe('ready')
			expect(result.current.file?.name).toBe('model.glb')
		})
	})

	it('keeps the model on screen when a drop fails while another is loading', async () => {
		/*
		  THE DEFECT. `modelOnScreen` was read from the current state and required
		  `ready` - but a load commits a blanking `loading` state on its way in, so
		  a third load starting while the second was still parsing saw `loading`,
		  captured nothing, and its failure committed an error state that took the
		  first model off the screen.

		  The case above is the same promise with no overlap, and it passed
		  throughout: the promise held only while the visitor did one thing at a
		  time, which is not when dropping the wrong file is easy.
		*/
		const { result } = renderHook(() => useLoadModel())

		await act(() =>
			result.current.load({ kind: 'files', files: [file('model.glb')] })
		)

		// B parks inside the loader, so the hook is mid-load, not idle.
		let slow: Promise<unknown> = Promise.resolve()
		await act(async () => {
			slow = result.current.load({
				kind: 'files',
				files: [file('slow.glb')]
			})
			await Promise.resolve()
		})

		await act(() =>
			result.current.load({ kind: 'files', files: [file('notes.txt')] })
		)

		await waitFor(() => {
			expect(result.current.status).toBe('ready')
			expect(result.current.file?.name).toBe('model.glb')
		})

		inFlight.release()
		await act(async () => {
			await slow
		})
	})

	it('surfaces a failed scene load rather than leaving the previous scene up', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: false,
				status: 500,
				statusText: 'Server Error'
			}))
		)

		const { result } = renderHook(() => useLoadModel())

		await act(() =>
			result.current.load({ kind: 'files', files: [file('model.glb')] })
		)
		// A scene replaces what is on screen, so its failure has to be visible:
		// the alternative is the previous scene's geometry under the new scene's
		// name, settings and save target.
		await act(() => result.current.load({ kind: 'server', sceneId: 'scene-1' }))

		await waitFor(() => expect(result.current.status).toBe('error'))
		expect(result.current.file).toBeNull()

		vi.unstubAllGlobals()
	})

	it('lets the newer load win when two overlap, and tells the loser', async () => {
		/*
		  The `status` half of this was already asserted and was the whole of it,
		  which made the test a statement that a retired load is indistinguishable
		  from a winning one - green, and holding the defect in place.

		  Both still resolve `ready`, deliberately: the loser did parse a real
		  model and a caller may want it. What it must not do is claim to describe
		  what is on screen, and `stillCurrent` is the only thing that separates
		  the two.
		*/
		const { result } = renderHook(() => useLoadModel())

		const [first, second] = await act(() =>
			Promise.all([
				result.current.load({ kind: 'files', files: [file('first.glb')] }),
				result.current.load({ kind: 'files', files: [file('second.glb')] })
			])
		)

		expect(first.status).toBe('ready')
		expect(second.status).toBe('ready')

		expect(first.stillCurrent()).toBe(false)
		expect(second.stillCurrent()).toBe(true)

		await waitFor(() => expect(result.current.file?.name).toBe('second.glb'))
	})

	it('reports a load retired by reset as no longer current', async () => {
		/*
		  `reset` claims a token of its own, so "the user cleared the model" and
		  "a newer file replaced it" are the same answer to the caller. Before
		  this, a caller running its own counter had to remember to bump it from
		  its reset path too, and the converter page did not - so pressing
		  "Convert another" while a drop was still in flight put the source back
		  after the stage had been emptied.
		*/
		const { result } = renderHook(() => useLoadModel())

		const outcome = await act(async () => {
			const pending = result.current.load({
				kind: 'files',
				files: [file('first.glb')]
			})
			result.current.reset()
			return pending
		})

		expect(outcome.stillCurrent()).toBe(false)
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
