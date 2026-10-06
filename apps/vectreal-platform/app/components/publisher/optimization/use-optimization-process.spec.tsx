// @vitest-environment jsdom
/**
 * `derivedFrom` says which settings produced the document on screen, and a save
 * persists it. It must follow the document: set by a pass that produced it, and
 * cleared by one that failed, because a failed pass puts the original back.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useOptimizationProcess } from './use-optimization-process'
import {
	balancedPreset,
	originalPreset,
	smallestPreset
} from '../../../constants/optimizations'
import {
	keptOriginalAtom,
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../lib/stores/scene-optimization-store'

import type { SceneOptimizationRuntimeState } from '../../../types/scene-optimization'
import type { ReactNode } from 'react'

const { runOptimizationPass, refreshOptimizedSizeInfo } = vi.hoisted(() => ({
	runOptimizationPass: vi.fn(),
	refreshOptimizedSizeInfo: vi.fn()
}))

vi.mock('./run-optimization-pass', () => ({ runOptimizationPass }))

vi.mock('./utils', () => ({
	useSceneSizeCalculator: () => ({
		calculateSceneBytes: vi.fn(),
		refreshOptimizedSizeInfo
	})
}))

/** The optimizer's source; a new load replaces it with a new array. */
const optimizerSource = vi.hoisted(() => ({
	current: new Uint8Array([1]) as Uint8Array
}))
/** The loader's newest load; opening another scene starts one at once. */
const loads = vi.hoisted(() => ({ latest: 1 }))
/** The load the hook last rendered with. */
const renderedLoad = vi.hoisted(() => ({ id: 1 }))
/** Whether the optimization drawer is open. */
const drawer = vi.hoisted(() => ({ open: true }))
/** Whether the optimizer holds a model; `setSource` takes it out while loading. */
const optimizerReady = vi.hoisted(() => ({ current: true }))
/** Re-renders the hook under test, as the optimizer's own state change does. */
const rerenderHook = vi.hoisted(() => ({ current: () => {} }))
/**
 * Stating the original replaces the optimizer's source with those bytes. Like
 * the real one, it renders the optimizer not ready while it loads and resolves
 * before the render that shows it ready again.
 */
const setSource = vi.hoisted(() =>
	vi.fn(async (bytes: Uint8Array) => {
		optimizerReady.current = false
		rerenderHook.current()
		await Promise.resolve()
		optimizerSource.current = bytes
		optimizerReady.current = true
	})
)

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		status: 'ready',
		loadId: renderedLoad.id,
		isLatestLoad: (loadId: number) => loadId === loads.latest,
		file: null,
		optimizer: {
			isReady: optimizerReady.current,
			isPreparing: false,
			report: null,
			info: null,
			getSource: () => optimizerSource.current,
			setSource
		}
	})
}))

function renderProcess() {
	const store = createStore()
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const { result, rerender } = renderHook(
		() => useOptimizationProcess({ isOpen: drawer.open }),
		{ wrapper }
	)
	rerenderHook.current = () => rerender()
	return {
		result,
		/**
		 * Starts another scene's load, whose source the optimizer has not yet.
		 * Nothing re-renders: the pass must hear of it before the drawer does.
		 */
		openAnotherScene: () => {
			loads.latest += 1
		},
		store,
		derivedFrom: () => store.get(optimizationAtom).derivedFrom,
		runtime: () => store.get(optimizationRuntimeAtom)
	}
}

beforeEach(() => {
	runOptimizationPass.mockReset()
	refreshOptimizedSizeInfo.mockReset()
	optimizerSource.current = new Uint8Array([1])
	optimizerReady.current = true
	loads.latest = 1
	renderedLoad.id = 1
	drawer.open = true
})

describe('useOptimizationProcess', () => {
	it('records the settings a successful pass derived the document from', async () => {
		runOptimizationPass.mockResolvedValue({
			succeeded: true,
			dracoReport: null
		})
		const { result, derivedFrom } = renderProcess()

		await act(() => result.current.derive(smallestPreset))

		expect(derivedFrom()).toBe(smallestPreset)
	})

	it('describes the document by its source when a pass fails', async () => {
		runOptimizationPass.mockResolvedValueOnce({
			succeeded: true,
			dracoReport: null
		})
		runOptimizationPass.mockResolvedValueOnce({
			succeeded: false,
			dracoReport: null
		})
		const { result, store, derivedFrom } = renderProcess()
		// A source that already embodies settings, as a reopened scene's does.
		store.set(optimizationAtom, (prev) => ({
			...prev,
			sourceSettings: smallestPreset
		}))

		// Records `balanced`, so the failure below has to replace it.
		await act(() => result.current.derive(balancedPreset))
		expect(derivedFrom()).toBe(balancedPreset)
		// Fails with settings a success would also have recorded as `balanced`.
		await act(() => result.current.derive(balancedPreset))

		// The failed pass put the source back on screen.
		expect(derivedFrom()).toBe(smallestPreset)
	})

	it('runs every pass with the settings it was asked for', async () => {
		runOptimizationPass.mockResolvedValue({
			succeeded: true,
			dracoReport: null
		})
		const { result } = renderProcess()

		await act(() => result.current.derive(smallestPreset))

		expect(runOptimizationPass).toHaveBeenCalledWith(
			expect.objectContaining({ optimizations: smallestPreset })
		)
	})

	// A scene saved optimized without its original has only that saved version
	// to return to; describing it as untouched would be false.
	it('describes choosing the original by what the source already is', async () => {
		runOptimizationPass.mockResolvedValue({
			succeeded: true,
			dracoReport: null
		})
		const { result, store, derivedFrom } = renderProcess()
		store.set(optimizationAtom, (prev) => ({
			...prev,
			sourceSettings: smallestPreset
		}))

		await act(() => result.current.derive(originalPreset))

		expect(derivedFrom()).toBe(smallestPreset)
	})

	// Leaving for another scene while a pass runs replaces the optimizer's
	// source; the old pass must not describe the new scene.
	it('drops the result of a pass whose scene was replaced meanwhile', async () => {
		runOptimizationPass.mockImplementation(async () => {
			optimizerSource.current = new Uint8Array([2])
			return { succeeded: true, dracoReport: null }
		})
		const { result, derivedFrom } = renderProcess()

		await act(() => result.current.derive(smallestPreset))

		expect(derivedFrom()).toBe(originalPreset)
	})

	// The new scene's state is hydrated as soon as it opens, but its source
	// replaces the old one only once its model is ingested. A pass finishing
	// in between must not write the old scene's settings into the new one.
	it('drops the result of a pass when another scene opens before its source arrives', async () => {
		let finish: () => void = () => {}
		runOptimizationPass.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = () => resolve({ succeeded: true, dracoReport: null })
				})
		)
		const { result, openAnotherScene, derivedFrom } = renderProcess()

		let pass: Promise<void> = Promise.resolve()
		act(() => {
			pass = result.current.derive(smallestPreset)
		})
		openAnotherScene()
		await act(async () => {
			finish()
			await pass
		})

		expect(derivedFrom()).toBe(originalPreset)
	})

	it('records what a pass measures while its scene is open', async () => {
		runOptimizationPass.mockImplementation(async (deps) => {
			deps.setRuntime((prev: SceneOptimizationRuntimeState) => ({
				...prev,
				clientSceneBytes: 999
			}))
			return { succeeded: true, dracoReport: null }
		})
		const { result, runtime } = renderProcess()

		await act(() => result.current.derive(smallestPreset))

		expect(runtime().clientSceneBytes).toBe(999)
	})

	it('drops what a pass measures once another scene has opened', async () => {
		const { result, openAnotherScene, runtime } = renderProcess()
		runOptimizationPass.mockImplementation(async (deps) => {
			openAnotherScene()
			deps.setRuntime((prev: SceneOptimizationRuntimeState) => ({
				...prev,
				clientSceneBytes: 999
			}))
			return { succeeded: false, dracoReport: null }
		})

		await act(() => result.current.derive(smallestPreset))

		expect(runtime().clientSceneBytes).not.toBe(999)
	})

	// The flag a pass raised has to come down even after its scene moved on,
	// or the drawer reads as busy for the rest of the session.
	it('gives a pass a writer its scene moving on does not filter', async () => {
		const { result, openAnotherScene, runtime } = renderProcess()
		runOptimizationPass.mockImplementation(async (deps) => {
			openAnotherScene()
			deps.setRuntimeUnfiltered((prev: SceneOptimizationRuntimeState) => ({
				...prev,
				clientSceneBytes: 999
			}))
			return { succeeded: false, dracoReport: null }
		})

		await act(() => result.current.derive(smallestPreset))

		expect(runtime().clientSceneBytes).toBe(999)
	})

	// The size refresh exports the whole document after the pass, which is
	// slow enough for the next scene to open in the meantime.
	it('drops the size measured after a pass once another scene has opened', async () => {
		runOptimizationPass.mockResolvedValue({
			succeeded: true,
			dracoReport: null
		})
		const { result, openAnotherScene, runtime } = renderProcess()
		refreshOptimizedSizeInfo.mockImplementation(
			async (
				_dracoReport: unknown,
				write: (
					update: (
						prev: SceneOptimizationRuntimeState
					) => SceneOptimizationRuntimeState
				) => void
			) => {
				openAnotherScene()
				write((prev) => ({ ...prev, optimizedSceneBytes: 777 }))
			}
		)

		await act(() => result.current.derive(smallestPreset))

		expect(refreshOptimizedSizeInfo).toHaveBeenCalledOnce()
		expect(runtime().optimizedSceneBytes).not.toBe(777)
	})

	it('drops a queued choice once its scene is no longer loaded', async () => {
		let finishFirst: () => void = () => {}
		runOptimizationPass.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishFirst = () => resolve({ succeeded: true, dracoReport: null })
				})
		)
		const { result } = renderProcess()

		let first: Promise<void> = Promise.resolve()
		act(() => {
			first = result.current.derive(smallestPreset)
			void result.current.derive(balancedPreset)
		})
		optimizerSource.current = new Uint8Array([3])
		await act(async () => {
			finishFirst()
			await first
		})

		expect(runOptimizationPass).toHaveBeenCalledOnce()
	})

	it('tells the pass when its scene has been replaced', async () => {
		let isCurrent: () => boolean = () => true
		runOptimizationPass.mockImplementation(async (deps) => {
			isCurrent = deps.isCurrent
			return { succeeded: true, dracoReport: null }
		})
		const { result } = renderProcess()

		await act(() => result.current.derive(smallestPreset))
		expect(isCurrent()).toBe(true)

		optimizerSource.current = new Uint8Array([4])
		expect(isCurrent()).toBe(false)
	})

	it('tells the pass when another scene has started loading', async () => {
		let isCurrent: () => boolean = () => true
		runOptimizationPass.mockImplementation(async (deps) => {
			isCurrent = deps.isCurrent
			return { succeeded: true, dracoReport: null }
		})
		const { result, openAnotherScene } = renderProcess()

		await act(() => result.current.derive(smallestPreset))
		expect(isCurrent()).toBe(true)

		openAnotherScene()
		expect(isCurrent()).toBe(false)
	})

	describe('a kept original on the server', () => {
		const stored = {
			assetId: 'original-1',
			url: '/api/scenes/s1/assets/original-1',
			fileName: 'source.glb',
			mimeType: 'model/gltf-binary',
			byteSize: 3
		}
		const keptAs = (ref: typeof stored | null) => ({
			keep: true,
			stored: ref,
			saved: true,
			unreadable: false
		})
		/** Answers each download when the spec says so, in any order. */
		const holdDownloads = () => {
			const responders: ((response: Response) => void)[] = []
			const fetchSpy = vi.fn(
				() => new Promise<Response>((resolve) => responders.push(resolve))
			)
			vi.stubGlobal('fetch', fetchSpy)
			return { fetchSpy, responders }
		}
		const settle = () =>
			act(() => new Promise((resolve) => setTimeout(resolve, 0)))

		afterEach(() => {
			vi.unstubAllGlobals()
			setSource.mockClear()
		})

		it('becomes the source when the drawer opens, before any choice', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn(async () => new Response(new Uint8Array([7, 7, 7])))
			)
			let sourceAtPass: Uint8Array | null = null
			runOptimizationPass.mockImplementation(async () => {
				sourceAtPass = optimizerSource.current
				return { succeeded: true, dracoReport: null }
			})
			const { result, store } = renderProcess()
			store.set(optimizationAtom, (prev) => ({
				...prev,
				sourceSettings: smallestPreset
			}))
			act(() => store.set(keptOriginalAtom, keptAs(stored)))

			await waitFor(() => expect(store.get(keptOriginalAtom).stored).toBeNull())
			expect(setSource).toHaveBeenCalledWith(new Uint8Array([7, 7, 7]))
			expect(store.get(optimizationAtom).sourceSettings).toBe(originalPreset)
			expect(result.current.isLoadingOriginal).toBe(false)

			await act(() => result.current.derive(balancedPreset))
			expect(sourceAtPass).toEqual(new Uint8Array([7, 7, 7]))
		})

		it('shows the original loading until it has loaded, downloading it once', async () => {
			const { fetchSpy, responders } = holdDownloads()
			const { result, store } = renderProcess()
			act(() => store.set(keptOriginalAtom, keptAs(stored)))
			// The model goes through a readiness change while it downloads.
			optimizerReady.current = false
			act(() => rerenderHook.current())
			optimizerReady.current = true
			act(() => rerenderHook.current())

			expect(fetchSpy).toHaveBeenCalledOnce()
			expect(result.current.isLoadingOriginal).toBe(true)
			await act(async () => {
				responders[0](new Response(new Uint8Array([7, 7, 7])))
			})
			await waitFor(() => expect(result.current.isLoadingOriginal).toBe(false))
		})

		it('never loads while the drawer is closed', () => {
			const { fetchSpy } = holdDownloads()
			drawer.open = false
			const { result, store } = renderProcess()
			act(() => store.set(keptOriginalAtom, keptAs(stored)))

			expect(fetchSpy).not.toHaveBeenCalled()
			expect(result.current.isLoadingOriginal).toBe(false)
		})

		it('waits for the optimizer to be ready before loading', () => {
			const { fetchSpy } = holdDownloads()
			optimizerReady.current = false
			const { store } = renderProcess()
			act(() => store.set(keptOriginalAtom, keptAs(stored)))
			expect(fetchSpy).not.toHaveBeenCalled()

			optimizerReady.current = true
			act(() => rerenderHook.current())

			expect(fetchSpy).toHaveBeenCalledOnce()
		})

		it('falls back to the saved version when it cannot be read, and tries again on the next opening', async () => {
			vi.spyOn(console, 'warn').mockImplementation(() => {})
			const fetchSpy = vi.fn(async () => new Response(null, { status: 500 }))
			vi.stubGlobal('fetch', fetchSpy)
			const { result, store } = renderProcess()
			act(() => store.set(keptOriginalAtom, keptAs(stored)))

			await waitFor(() =>
				expect(store.get(keptOriginalAtom).unreadable).toBe(true)
			)
			expect(store.get(keptOriginalAtom).stored).toBe(stored)
			expect(result.current.isLoadingOriginal).toBe(false)
			expect(setSource).not.toHaveBeenCalled()

			drawer.open = false
			act(() => rerenderHook.current())
			drawer.open = true
			act(() => rerenderHook.current())

			await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
		})

		it('never states an older original after a newer one has loaded', async () => {
			const { responders } = holdDownloads()
			const { store } = renderProcess()
			act(() => store.set(keptOriginalAtom, keptAs(stored)))
			// The scene hydrates again and states its original anew.
			act(() => store.set(keptOriginalAtom, keptAs({ ...stored })))

			await act(async () => {
				responders[1](new Response(new Uint8Array([2, 2, 2])))
			})
			await settle()
			await act(async () => {
				responders[0](new Response(new Uint8Array([1, 1, 1])))
			})
			await settle()

			expect(setSource).toHaveBeenCalledOnce()
			expect(optimizerSource.current).toEqual(new Uint8Array([2, 2, 2]))
		})

		it("never states a closed scene's original", async () => {
			const { responders } = holdDownloads()
			const { store } = renderProcess()
			act(() => store.set(keptOriginalAtom, keptAs(stored)))

			loads.latest = 2
			renderedLoad.id = 2
			act(() => store.set(keptOriginalAtom, keptAs(null)))
			await act(async () => {
				responders[0](new Response(new Uint8Array([7, 7, 7])))
			})
			await settle()

			expect(setSource).not.toHaveBeenCalled()
		})
	})
})
