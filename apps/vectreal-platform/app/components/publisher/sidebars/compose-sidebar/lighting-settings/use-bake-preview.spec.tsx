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
	drawingLabel,
	type ShownBakeContext,
	useBakePreview,
	usePublishExport,
	useShownBake
} from './use-bake-preview'
import { bakePreviewAtom } from '../../../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../../../lib/stores/scene-optimization-store'
import {
	lightingAtom,
	presentationAtom
} from '../../../../../lib/stores/scene-settings-store'

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
vi.mock(
	'../../../../../lib/domain/scene/client/publish-export',
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		runPublishExportInWorker: mocks.runPublishExportInWorker
	})
)
vi.mock('../../../optimization/use-hold-to-compare', () => ({
	disposeModel: mocks.disposeModel
}))

const report = { baked: ['body'], skipped: [] }
const litLighting = {
	lights: [{ role: 'key' as const, azimuth: 30 }],
	bake: { lights: true }
}

function setup(
	viewer: ShownBakeContext = {
		isLightingOpen: false,
		canAnimate: false,
		isAnimating: false
	}
) {
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
			const shown = useShownBake(viewer)
			rendered.shown = shown
			return {
				preview: useBakePreview(),
				publishExport: usePublishExport(),
				shown
			}
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

describe('the bake preview', () => {
	it('runs the export publishing would, and keeps its file beside the result shown', async () => {
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		const [request] = mocks.runPublishExportInWorker.mock.calls[0]
		expect(request).toEqual({
			buffer: expect.any(ArrayBuffer),
			...hook.result.current.publishExport.request
		})
		expect(request).toMatchObject({ occlusion: true })
		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'ready',
			reports: { occlusion: report },
			outcome: { buffer: expect.any(ArrayBuffer), occlusion: report }
		})
		expect(hook.result.current.shown).toBeInstanceOf(Group)
	})

	it('says which bake is drawing and how far, until the preview is ready', async () => {
		let finish: (value: unknown) => void = () => {}
		mocks.runPublishExportInWorker.mockImplementation(
			(_request, onProgress: (progress: object) => void) => {
				onProgress({ stage: 'occlusion', fraction: 0.4 })
				return new Promise((resolve) => {
					finish = resolve
				})
			}
		)
		const { hook } = setup()

		act(() => void hook.result.current.preview.bake())
		await waitFor(() =>
			expect(hook.result.current.preview.preview?.progress).toEqual({
				stage: 'occlusion',
				fraction: 0.4
			})
		)
		expect(drawingLabel(hook.result.current.preview.preview?.progress)).toBe(
			'Drawing the depth (40%)'
		)

		await act(async () =>
			finish({ buffer: new ArrayBuffer(8), occlusion: report })
		)
		await waitFor(() =>
			expect(hook.result.current.preview.preview?.status).toBe('ready')
		)
		expect(hook.result.current.preview.preview?.progress).toBeUndefined()
	})

	it('bakes the studio lights publishing would bake, and shows them', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			lights: report
		})
		const { store, hook } = setup()
		act(() => store.set(lightingAtom, litLighting))

		await act(() => hook.result.current.preview.bake())

		expect(mocks.runPublishExportInWorker).toHaveBeenCalledWith(
			expect.objectContaining({
				occlusion: false,
				lights: expect.objectContaining({
					lights: [expect.objectContaining({ role: 'key', azimuth: 30 })]
				})
			}),
			expect.any(Function)
		)
		expect(hook.result.current.preview.preview?.reports).toEqual({
			occlusion: undefined,
			lights: report
		})
		expect(hook.result.current.shown).toBeInstanceOf(Group)
	})

	it('encodes the textures for the GPU when publishing would', async () => {
		const { store, hook } = setup()
		act(() =>
			store.set(presentationAtom, (prev) => ({
				...prev,
				compressTexturesForGpu: true
			}))
		)

		await act(() => hook.result.current.preview.bake())

		expect(mocks.runPublishExportInWorker.mock.calls[0][0]).toMatchObject({
			ktx2: true
		})
	})

	it('goes stale once publishing would encode the textures differently', async () => {
		const { store, hook } = setup()
		await act(() => hook.result.current.preview.bake())
		expect(hook.result.current.preview.preview).not.toBeNull()

		act(() =>
			store.set(presentationAtom, (prev) => ({
				...prev,
				compressTexturesForGpu: !hook.result.current.publishExport.request.ktx2
			}))
		)

		expect(hook.result.current.preview.preview).toBeNull()
	})

	it('drops a light bake once a baked light moves', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			lights: report
		})
		const { store, hook } = setup()
		act(() => store.set(lightingAtom, litLighting))
		await act(() => hook.result.current.preview.bake())

		act(() =>
			store.set(lightingAtom, {
				...litLighting,
				lights: [{ role: 'key', azimuth: 31 }]
			})
		)

		expect(hook.result.current.preview.preview).toBeNull()
		expect(hook.result.current.shown).toBeUndefined()
	})

	it('reports a failed light bake instead of showing anything', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			lights: { failed: 'The GPU reset while baking the studio lights' }
		})
		const { store, hook } = setup()
		act(() => store.set(lightingAtom, litLighting))

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'failed',
			error: 'The GPU reset while baking the studio lights'
		})
		expect(mocks.loadToThreeJS).not.toHaveBeenCalled()
	})

	it('shows the bake that worked when the other failed, as publishing ships it', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			occlusion: report,
			lights: { failed: 'The GPU reset while baking the studio lights' }
		})
		const { store, hook } = setup()
		act(() =>
			store.set(lightingAtom, { ...litLighting, occlusion: { mode: 'baked' } })
		)

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'ready',
			reports: {
				occlusion: report,
				lights: { failed: 'The GPU reset while baking the studio lights' }
			}
		})
		expect(hook.result.current.shown).toBeInstanceOf(Group)
	})

	it('has nothing to bake until the lighting asks for a bake', async () => {
		const { store, hook } = setup()
		act(() => store.set(lightingAtom, { occlusion: { mode: 'live' } }))

		expect(hook.result.current.preview.bakesAnything).toBe(false)
		expect(hook.result.current.preview.canBake).toBe(false)
		await act(() => hook.result.current.preview.bake())
		expect(mocks.runPublishExportInWorker).not.toHaveBeenCalled()
	})

	it('shows the model as it is when the author switches the bake off', async () => {
		const { hook } = setup()
		await act(() => hook.result.current.preview.bake())

		act(() => hook.result.current.preview.setShown(false))

		expect(hook.result.current.shown).toBeUndefined()
	})

	it('shows the bake outside the Lighting tool when nothing can pose the model, while set to baked', async () => {
		const { store, hook } = setup()
		await act(() => hook.result.current.preview.bake())
		expect(hook.result.current.shown).toBeInstanceOf(Group)

		act(() => store.set(lightingAtom, { occlusion: { mode: 'live' } }))
		expect(hook.result.current.shown).toBeUndefined()
	})

	it('keeps an animatable model live outside the Lighting tool, where it may be posed', async () => {
		const { store, hook } = setup({
			isLightingOpen: false,
			canAnimate: true,
			isAnimating: false
		})
		await act(() => hook.result.current.preview.bake())

		expect(store.get(bakePreviewAtom)?.status).toBe('ready')
		expect(hook.result.current.shown).toBeUndefined()
	})

	it('shows an animatable model baked inside the Lighting tool while no clip plays', async () => {
		const { hook } = setup({
			isLightingOpen: true,
			canAnimate: true,
			isAnimating: false
		})
		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.shown).toBeInstanceOf(Group)
	})

	it('shows the live model while a clip plays, even inside the Lighting tool', async () => {
		const { store, hook } = setup({
			isLightingOpen: true,
			canAnimate: true,
			isAnimating: true
		})
		await act(() => hook.result.current.preview.bake())

		expect(store.get(bakePreviewAtom)?.status).toBe('ready')
		expect(hook.result.current.shown).toBeUndefined()
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
		const latest = store.get(bakePreviewAtom)?.model

		await act(async () => {
			finishFirst({ buffer: new ArrayBuffer(8), occlusion: report })
			await first
		})

		await waitFor(() => expect(mocks.disposeModel).toHaveBeenCalled())
		expect(store.get(bakePreviewAtom)?.model).toBe(latest)
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
		const baked = store.get(bakePreviewAtom)?.model

		act(() =>
			store.set(optimizationRuntimeAtom, (runtime) => ({
				...runtime,
				passRevision: runtime.passRevision + 1
			}))
		)

		await waitFor(() => expect(store.get(bakePreviewAtom)).toBeNull())
		expect(mocks.disposeModel).toHaveBeenCalledWith(baked)
	})

	it('frees a replaced bake only after the viewer has let go of it', async () => {
		const { store, hook, rendered } = setup()
		await act(() => hook.result.current.preview.bake())
		const first = store.get(bakePreviewAtom)?.model

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
		const baked = store.get(bakePreviewAtom)?.model

		hook.unmount()

		expect(mocks.disposeModel).toHaveBeenCalledWith(baked)
		expect(store.get(bakePreviewAtom)).toBeNull()
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
