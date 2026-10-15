// @vitest-environment jsdom
/**
 * The size the publisher shows is what publish would ship for the document on
 * screen, measured by publish's own export. A published scene whose document
 * is the saved one shows the file visitors get instead.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	usePublishSizeProjection,
	useSizeExcludesTextureEncoding
} from './use-publish-size-projection'
import {
	balancedPreset,
	originalPreset
} from '../../../constants/optimizations'
import { resolvePublishGeometryOptions } from '../../../lib/domain/scene/client/publish-export'
import { processAtom } from '../../../lib/stores/publisher-config-store'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../lib/stores/scene-optimization-store'

import type {
	PublishedEncoding,
	SceneOptimizationRuntimeState
} from '../../../types/scene-optimization'
import type { DracoCompressionReport } from '@vctrl/core'

const projectPublishedGlbBytes = vi.hoisted(() => vi.fn())
vi.mock(
	'../../../lib/domain/scene/client/publish-export',
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		projectPublishedGlbBytes
	})
)

const optimizerState = vi.hoisted(() => ({ isReady: true }))
const WORKING = new Uint8Array([7, 7, 7])
vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		status: 'ready',
		loadId: 1,
		optimizer: {
			isReady: optimizerState.isReady,
			getModel: async () => WORKING
		}
	})
}))

function createDeferred<T>() {
	let resolve: (value: T) => void = () => {}
	const promise = new Promise<T>((done) => (resolve = done))
	return { promise, resolve }
}

const runtime = () => store.get(optimizationRuntimeAtom)
const setRuntime = (patch: Partial<SceneOptimizationRuntimeState>) =>
	act(() =>
		store.set(optimizationRuntimeAtom, (prev) => ({ ...prev, ...patch }))
	)

let store: ReturnType<typeof createStore>

function renderProjection() {
	const wrapper = ({ children }: { children: ReactNode }) =>
		createElement(Provider, { store }, children)
	return renderHook(() => usePublishSizeProjection(), { wrapper })
}

beforeEach(() => {
	store = createStore()
	store.set(optimizationAtom, (prev) => ({
		...prev,
		derivedFrom: balancedPreset
	}))
	optimizerState.isReady = true
	projectPublishedGlbBytes.mockReset()
	projectPublishedGlbBytes.mockResolvedValue(861)
})

describe('usePublishSizeProjection', () => {
	it('measures an opened scene as publish would encode it', async () => {
		const dracoReport = { isWorthApplying: false } as DracoCompressionReport
		store.set(optimizationRuntimeAtom, (prev) => ({ ...prev, dracoReport }))
		renderProjection()

		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(861))
		expect(projectPublishedGlbBytes).toHaveBeenCalledWith(
			WORKING,
			resolvePublishGeometryOptions(balancedPreset, dracoReport)
		)
		expect(projectPublishedGlbBytes.mock.calls[0][1].dracoWorthApplying).toBe(
			false
		)
		expect(runtime().isProjectingSceneBytes).toBe(false)
	})

	it('waits for the optimizer to hold the document', async () => {
		optimizerState.isReady = false
		const { rerender } = renderProjection()
		expect(projectPublishedGlbBytes).not.toHaveBeenCalled()

		optimizerState.isReady = true
		rerender()

		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(861))
	})

	it('says it is measuring until the figure lands', async () => {
		const pending = createDeferred<number>()
		projectPublishedGlbBytes.mockReturnValue(pending.promise)
		renderProjection()

		await waitFor(() => expect(runtime().isProjectingSceneBytes).toBe(true))
		await act(async () => pending.resolve(861))

		expect(runtime()).toMatchObject({
			isProjectingSceneBytes: false,
			optimizedSceneBytes: 861
		})
	})

	it('keeps the size a publish recorded while the document is the saved one', async () => {
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			latestSceneStats: { currentSceneBytes: 995 } as never
		}))
		renderProjection()
		await act(async () => {})

		expect(projectPublishedGlbBytes).not.toHaveBeenCalled()
		expect(runtime().optimizedSceneBytes).toBeNull()
	})

	// The GPU texture switch, or any other unsaved change, is what the next
	// publish ships, so the published file stops being the figure to show.
	it('replaces a published size once anything is unsaved', async () => {
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			latestSceneStats: { currentSceneBytes: 995 } as never,
			optimizedSceneBytes: 995,
			publishedEncoding: { geometryCodec: 'draco' } as PublishedEncoding
		}))
		renderProjection()
		await act(async () => {})
		expect(projectPublishedGlbBytes).not.toHaveBeenCalled()

		act(() =>
			store.set(processAtom, (prev) => ({ ...prev, hasUnsavedChanges: true }))
		)

		await waitFor(() =>
			expect(runtime()).toMatchObject({
				optimizedSceneBytes: 861,
				publishedEncoding: null
			})
		)
	})

	it('measures again after publishing in this tab, once anything is unsaved', async () => {
		renderProjection()
		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(861))

		setRuntime({
			latestSceneStats: { currentSceneBytes: 995 } as never,
			optimizedSceneBytes: 995,
			publishedEncoding: { geometryCodec: 'draco' } as PublishedEncoding
		})
		await act(async () => {})
		act(() =>
			store.set(processAtom, (prev) => ({ ...prev, hasUnsavedChanges: true }))
		)

		await waitFor(() =>
			expect(runtime()).toMatchObject({
				optimizedSceneBytes: 861,
				publishedEncoding: null
			})
		)
	})

	it('shows the published size again once nothing is unsaved', async () => {
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			latestSceneStats: { currentSceneBytes: 995 } as never
		}))
		renderProjection()
		act(() =>
			store.set(processAtom, (prev) => ({ ...prev, hasUnsavedChanges: true }))
		)
		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(861))

		act(() =>
			store.set(processAtom, (prev) => ({ ...prev, hasUnsavedChanges: false }))
		)

		await waitFor(() => expect(runtime().optimizedSceneBytes).toBeNull())
	})

	it('keeps an unpublished scene’s projection while a pass runs', async () => {
		renderProjection()
		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(861))

		setRuntime({ isPending: true, passRevision: 1 })
		await act(async () => {})

		expect(runtime().optimizedSceneBytes).toBe(861)
	})

	it('keeps the size of a publish made in this tab', async () => {
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			latestSceneStats: { currentSceneBytes: 995 } as never,
			optimizedSceneBytes: 995,
			publishedEncoding: { geometryCodec: 'draco' } as PublishedEncoding
		}))
		renderProjection()
		await act(async () => {})

		expect(runtime().optimizedSceneBytes).toBe(995)
	})

	it('measures a published scene once a pass changes its document', async () => {
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			latestSceneStats: { currentSceneBytes: 995 } as never
		}))
		renderProjection()
		await act(async () => {})

		setRuntime({ passRevision: 1 })

		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(861))
	})

	it('measures again after a pass, and not while it runs', async () => {
		renderProjection()
		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(861))

		projectPublishedGlbBytes.mockResolvedValue(500)
		setRuntime({ isPending: true, passRevision: 1 })
		await act(async () => {})
		expect(projectPublishedGlbBytes).toHaveBeenCalledTimes(1)

		setRuntime({ isPending: false })
		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(500))
	})

	it('drops a figure for a document a pass replaced meanwhile', async () => {
		const stale = createDeferred<number>()
		projectPublishedGlbBytes.mockReturnValueOnce(stale.promise)
		renderProjection()
		await waitFor(() => expect(projectPublishedGlbBytes).toHaveBeenCalled())

		setRuntime({ isPending: true, passRevision: 1 })
		await act(async () => stale.resolve(1_400))

		expect(runtime().optimizedSceneBytes).toBeNull()
		// Abandoned, so nothing is shown as still being measured.
		expect(runtime().isProjectingSceneBytes).toBe(false)
	})

	it('lets the newest measurement win when the encoding changes meanwhile', async () => {
		const stale = createDeferred<number>()
		projectPublishedGlbBytes
			.mockReturnValueOnce(stale.promise)
			.mockResolvedValueOnce(700)
		renderProjection()
		await waitFor(() => expect(projectPublishedGlbBytes).toHaveBeenCalled())

		setRuntime({
			dracoReport: { isWorthApplying: false } as DracoCompressionReport
		})
		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(700))
		await act(async () => stale.resolve(1_400))

		expect(runtime().optimizedSceneBytes).toBe(700)
	})

	it('leaves the size of a file published meanwhile alone', async () => {
		const pending = createDeferred<number>()
		projectPublishedGlbBytes.mockReturnValue(pending.promise)
		renderProjection()
		await waitFor(() => expect(projectPublishedGlbBytes).toHaveBeenCalled())

		setRuntime({
			optimizedSceneBytes: 995,
			publishedEncoding: { geometryCodec: 'draco' } as PublishedEncoding
		})
		await act(async () => pending.resolve(861))

		expect(runtime().optimizedSceneBytes).toBe(995)
	})

	it('measures again when hydration clears the figure', async () => {
		renderProjection()
		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(861))

		setRuntime({ optimizedSceneBytes: null })

		await waitFor(() => expect(runtime().optimizedSceneBytes).toBe(861))
		expect(projectPublishedGlbBytes).toHaveBeenCalledTimes(2)
	})
})

describe('useSizeExcludesTextureEncoding', () => {
	const renderExcludes = () =>
		renderHook(() => useSizeExcludesTextureEncoding(), {
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(Provider, { store }, children)
		}).result

	it('marks a projection whose publish encodes textures for the GPU', () => {
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			optimizedSceneBytes: 861
		}))

		expect(renderExcludes().current).toBe(true)
	})

	it('leaves the size of a published file unmarked', () => {
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			optimizedSceneBytes: 995,
			publishedEncoding: { geometryCodec: 'draco' } as PublishedEncoding
		}))

		expect(renderExcludes().current).toBe(false)
	})

	it('leaves a scene that ships its textures as they are unmarked', () => {
		store.set(optimizationAtom, (prev) => ({
			...prev,
			derivedFrom: originalPreset
		}))
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			optimizedSceneBytes: 861
		}))

		expect(renderExcludes().current).toBe(false)
	})

	it('leaves a stored size unmarked', () => {
		expect(renderExcludes().current).toBe(false)
	})
})
