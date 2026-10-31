// @vitest-environment jsdom
/**
 * How a preview of the publish bake is made, kept to its document, and shown.
 * The bake itself runs in the publish worker, mocked here.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { Group } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	useOcclusionBakePreview,
	useShownOcclusionBake
} from './use-occlusion-bake-preview'
import { occlusionBakePreviewAtom } from '../../../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../../../lib/stores/scene-optimization-store'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'

import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
	document: {} as object | null,
	runPublishExportInWorker: vi.fn(),
	loadToThreeJS: vi.fn(),
	exportDocumentGLB: vi.fn(),
	disposeModel: vi.fn()
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		optimizer: { _getDocument: () => mocks.document }
	})
}))
vi.mock('@vctrl/core/model-exporter', () => ({
	ModelExporter: class {
		exportDocumentGLB = mocks.exportDocumentGLB
	}
}))
vi.mock('@vctrl/core/model-loader', () => ({
	ModelLoader: class {
		loadToThreeJS = mocks.loadToThreeJS
	}
}))
vi.mock('../../../../../lib/domain/scene/client/publish-export', () => ({
	runPublishExportInWorker: mocks.runPublishExportInWorker
}))
vi.mock('../../../optimization/use-hold-to-compare', () => ({
	disposeModel: mocks.disposeModel
}))

const report = { baked: ['body'], skipped: [] }

function setup(lightingOpen = true) {
	const store = createStore()
	store.set(lightingAtom, { occlusion: { mode: 'baked' } })
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	// What the last render handed the viewer. `result.current` would not do:
	// renderHook updates it from an effect that runs after the hook's own.
	const rendered: { shown?: unknown } = {}
	const hook = renderHook(
		() => {
			const shown = useShownOcclusionBake(lightingOpen)
			rendered.shown = shown
			return { preview: useOcclusionBakePreview(), shown }
		},
		{ wrapper }
	)
	return { store, hook, rendered }
}

beforeEach(() => {
	vi.clearAllMocks()
	mocks.document = {}
	mocks.exportDocumentGLB.mockResolvedValue({ data: new Uint8Array(4) })
	mocks.runPublishExportInWorker.mockResolvedValue({
		buffer: new ArrayBuffer(8),
		occlusion: report
	})
	mocks.loadToThreeJS.mockImplementation(async () => ({ scene: new Group() }))
})

describe('the occlusion bake preview', () => {
	it('bakes in the publish worker with only the bake on, and shows the result', async () => {
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		expect(mocks.runPublishExportInWorker).toHaveBeenCalledWith(
			expect.objectContaining({ occlusion: true, ktx2: false }),
			expect.any(Function)
		)
		expect(mocks.runPublishExportInWorker.mock.calls[0][0]).not.toHaveProperty(
			'draco'
		)
		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'ready',
			report
		})
		expect(hook.result.current.shown).toBeInstanceOf(Group)
	})

	it('shows the model as it is when the author switches the bake off', async () => {
		const { hook } = setup()
		await act(() => hook.result.current.preview.bake())

		act(() => hook.result.current.preview.setShown(false))

		expect(hook.result.current.shown).toBeUndefined()
	})

	it('shows the bake only inside the Lighting tool and while set to baked', async () => {
		const closed = setup(false)
		await act(() => closed.hook.result.current.preview.bake())
		expect(closed.hook.result.current.shown).toBeUndefined()

		const open = setup()
		await act(() => open.hook.result.current.preview.bake())
		act(() => open.store.set(lightingAtom, { occlusion: { mode: 'live' } }))
		expect(open.hook.result.current.shown).toBeUndefined()
	})

	it('drops a preview made for another optimization pass', async () => {
		const { store, hook } = setup()
		await act(() => hook.result.current.preview.bake())

		act(() =>
			store.set(optimizationRuntimeAtom, (runtime) => ({
				...runtime,
				passRevision: runtime.passRevision + 1
			}))
		)

		expect(hook.result.current.preview.preview).toBeNull()
		expect(hook.result.current.shown).toBeUndefined()
	})

	it('drops a preview made for another model', async () => {
		const { hook } = setup()
		await act(() => hook.result.current.preview.bake())

		mocks.document = {}
		hook.rerender()

		expect(hook.result.current.preview.preview).toBeNull()
		expect(hook.result.current.shown).toBeUndefined()
	})

	it('reports a failed bake instead of showing anything', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			occlusion: { failed: 'WebGL 2 is unavailable' }
		})
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'failed',
			error: 'WebGL 2 is unavailable'
		})
		expect(mocks.loadToThreeJS).not.toHaveBeenCalled()
		expect(hook.result.current.shown).toBeUndefined()
	})

	it('frees a bake that finishes after a newer one started', async () => {
		let finishFirst: (value: unknown) => void = () => {}
		mocks.runPublishExportInWorker.mockImplementationOnce(
			() => new Promise((resolve) => (finishFirst = resolve))
		)
		const { store, hook } = setup()

		let first: Promise<void> = Promise.resolve()
		act(() => {
			first = hook.result.current.preview.bake()
		})
		await act(() => hook.result.current.preview.bake())
		const latest = store.get(occlusionBakePreviewAtom)?.model

		await act(async () => {
			finishFirst({ buffer: new ArrayBuffer(8), occlusion: report })
			await first
		})

		await waitFor(() => expect(mocks.disposeModel).toHaveBeenCalled())
		expect(store.get(occlusionBakePreviewAtom)?.model).toBe(latest)
		expect(mocks.disposeModel).not.toHaveBeenCalledWith(latest)
	})

	it('waits for an optimization pass to finish before it bakes', async () => {
		const { store, hook } = setup()
		act(() =>
			store.set(optimizationRuntimeAtom, (runtime) => ({
				...runtime,
				isPending: true
			}))
		)

		expect(hook.result.current.preview.canBake).toBe(false)
		await act(() => hook.result.current.preview.bake())
		expect(mocks.runPublishExportInWorker).not.toHaveBeenCalled()
	})

	it('clears and frees a preview once it has gone stale', async () => {
		const { store, hook } = setup()
		await act(() => hook.result.current.preview.bake())
		const baked = store.get(occlusionBakePreviewAtom)?.model

		act(() =>
			store.set(optimizationRuntimeAtom, (runtime) => ({
				...runtime,
				passRevision: runtime.passRevision + 1
			}))
		)

		await waitFor(() => expect(store.get(occlusionBakePreviewAtom)).toBeNull())
		expect(mocks.disposeModel).toHaveBeenCalledWith(baked)
	})

	it('frees a replaced bake only after the viewer has let go of it', async () => {
		const { store, hook, rendered } = setup()
		await act(() => hook.result.current.preview.bake())
		const first = store.get(occlusionBakePreviewAtom)?.model

		let finish: (value: unknown) => void = () => {}
		mocks.runPublishExportInWorker.mockImplementationOnce(
			() => new Promise((resolve) => (finish = resolve))
		)
		const drawnWhenFreed: unknown[] = []
		mocks.disposeModel.mockImplementation(() =>
			drawnWhenFreed.push(rendered.shown)
		)
		let second: Promise<void> = Promise.resolve()
		act(() => {
			second = hook.result.current.preview.bake()
		})

		expect(mocks.disposeModel).toHaveBeenCalledWith(first)
		// The render that dropped it had already committed when it was freed.
		expect(drawnWhenFreed).toEqual([undefined])

		await waitFor(() =>
			expect(mocks.runPublishExportInWorker).toHaveBeenCalledTimes(2)
		)
		await act(async () => {
			finish({ buffer: new ArrayBuffer(8), occlusion: report })
			await second
		})
		expect(hook.result.current.shown).not.toBe(first)
	})

	it('frees the bake when the publisher closes', async () => {
		const { store, hook } = setup()
		await act(() => hook.result.current.preview.bake())
		const baked = store.get(occlusionBakePreviewAtom)?.model

		hook.unmount()

		expect(mocks.disposeModel).toHaveBeenCalledWith(baked)
		expect(store.get(occlusionBakePreviewAtom)).toBeNull()
	})

	it('keeps the model as it is when the bake changed nothing', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			occlusion: {
				baked: [],
				skipped: [{ material: 'body', reason: 'skinned' }]
			}
		})
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview?.status).toBe('ready')
		expect(hook.result.current.shown).toBeUndefined()
	})

	it('cannot bake without a model', () => {
		mocks.document = null
		const { hook } = setup()

		expect(hook.result.current.preview.canBake).toBe(false)
	})
})
