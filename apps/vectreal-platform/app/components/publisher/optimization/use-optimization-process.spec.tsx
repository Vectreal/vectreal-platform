// @vitest-environment jsdom
/**
 * `derivedFrom` says which settings produced the document on screen, and a save
 * persists it. It must follow the document: set by a pass that produced it, and
 * cleared by one that failed, because a failed pass puts the original back.
 */
import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useOptimizationProcess } from './use-optimization-process'
import {
	balancedPreset,
	originalPreset,
	smallestPreset
} from '../../../constants/optimizations'
import {
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
const optimizerSource = vi.hoisted(() => ({ current: new Uint8Array([1]) }))
/** The loader's newest load; opening another scene starts one at once. */
const loads = vi.hoisted(() => ({ latest: 1 }))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		status: 'ready',
		loadId: 1,
		isLatestLoad: (loadId: number) => loadId === loads.latest,
		file: null,
		optimizer: {
			isReady: true,
			isPreparing: false,
			report: null,
			info: null,
			getSource: () => optimizerSource.current
		}
	})
}))

function renderProcess() {
	const store = createStore()
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const { result } = renderHook(() => useOptimizationProcess(), { wrapper })
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
	loads.latest = 1
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
})
