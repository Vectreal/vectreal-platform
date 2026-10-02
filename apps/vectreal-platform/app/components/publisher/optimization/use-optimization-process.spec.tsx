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
import { optimizationAtom } from '../../../lib/stores/scene-optimization-store'

import type { ReactNode } from 'react'

const { runOptimizationPass } = vi.hoisted(() => ({
	runOptimizationPass: vi.fn()
}))

vi.mock('./run-optimization-pass', () => ({ runOptimizationPass }))

vi.mock('./utils', () => ({
	useSceneSizeCalculator: () => ({
		calculateSceneBytes: vi.fn(),
		refreshOptimizedSizeInfo: vi.fn()
	})
}))

/** The optimizer's source; a new load replaces it with a new array. */
const optimizerSource = vi.hoisted(() => ({ current: new Uint8Array([1]) }))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
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
		store,
		derivedFrom: () => store.get(optimizationAtom).derivedFrom
	}
}

beforeEach(() => {
	runOptimizationPass.mockReset()
	optimizerSource.current = new Uint8Array([1])
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
})
