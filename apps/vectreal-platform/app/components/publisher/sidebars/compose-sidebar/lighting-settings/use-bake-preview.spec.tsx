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
	studioFinishToSave,
	useBakePreview,
	usePublishExport,
	useRestoreSavedFinish,
	useShowPublishedFinish,
	useShownBake
} from './use-bake-preview'
import { bakesKey } from '../../../../../lib/domain/scene/studio-finish'
import {
	bakePreviewAtom,
	processAtom,
	type BakePreview
} from '../../../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../../../lib/stores/scene-optimization-store'
import {
	lightingAtom,
	presentationAtom
} from '../../../../../lib/stores/scene-settings-store'
import { WorkerRunError } from '../../../../../workers/run-worker'

import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
	document: {} as object | null,
	runPublishExportInWorker: vi.fn(),
	loadToThreeJS: vi.fn(),
	exportDocumentGLB: vi.fn(),
	disposeModel: vi.fn(),
	reportError: vi.fn()
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
vi.mock('../../../../../lib/observability/use-error-report', () => ({
	useErrorReport: mocks.reportError
}))

/** What the last render handed error tracking, if anything. */
const lastReported = () => mocks.reportError.mock.calls.at(-1)?.[0]

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
	vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('the bake preview', () => {
	it('runs the export publishing would, and keeps its file beside the result shown', async () => {
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		const [request] = mocks.runPublishExportInWorker.mock.calls[0]
		expect(request).toEqual({
			glb: expect.any(Uint8Array),
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
			lights: { failed: 'gpu-reset', detail: 'GPU reset while baking body' }
		})
		const { store, hook } = setup()
		act(() => store.set(lightingAtom, litLighting))

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'failed',
			failure: { reason: 'gpu-reset', detail: 'GPU reset while baking body' }
		})
		expect(mocks.loadToThreeJS).not.toHaveBeenCalled()
		// The author can act on a reset, so it is not a fault to report.
		expect(lastReported()).toBeUndefined()
	})

	it('shows the bake that worked when the other failed, as publishing ships it', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			occlusion: report,
			lights: { failed: 'gpu-reset', detail: 'GPU reset while baking body' }
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
				lights: { failed: 'gpu-reset', detail: 'GPU reset while baking body' }
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
			occlusion: { failed: 'no-webgl', detail: 'Error creating WebGL context.' }
		})
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'failed',
			failure: { reason: 'no-webgl', detail: 'Error creating WebGL context.' }
		})
		expect(mocks.loadToThreeJS).not.toHaveBeenCalled()
		expect(hook.result.current.shown).toBeUndefined()
	})

	it('reports a fatal failure to error tracking once, by its reason and detail', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			occlusion: { failed: 'no-webgl', detail: 'Error creating WebGL context.' }
		})
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())
		const reported = lastReported()
		act(() => hook.result.current.preview.setShown(false))

		expect(reported).toBeInstanceOf(Error)
		expect(reported.message).toBe(
			'Studio finish no-webgl: Error creating WebGL context.'
		)
		expect(mocks.reportError).toHaveBeenLastCalledWith(
			reported,
			'client-fallback'
		)
		// Hiding the preview is not a new failure.
		expect(lastReported()).toBe(reported)
	})

	it('reports a fatal bake that failed beside one that worked', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			occlusion: report,
			lights: { failed: 'unexpected', detail: 'undefined is not a function' }
		})
		const { store, hook } = setup()
		act(() =>
			store.set(lightingAtom, { ...litLighting, occlusion: { mode: 'baked' } })
		)

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview?.status).toBe('ready')
		expect(lastReported()?.message).toBe(
			'Studio finish unexpected: undefined is not a function'
		)
	})

	it('reports a fatal failure of the second bake when the first failed for a reason the author can fix', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			occlusion: { failed: 'gpu-reset', detail: 'reset' },
			lights: { failed: 'unexpected', detail: 'undefined is not a function' }
		})
		const { store, hook } = setup()
		act(() =>
			store.set(lightingAtom, { ...litLighting, occlusion: { mode: 'baked' } })
		)

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'failed',
			failure: { reason: 'gpu-reset' }
		})
		expect(lastReported()?.message).toBe(
			'Studio finish unexpected: undefined is not a function'
		)
	})

	it('says the browser stopped the drawing when the worker crashed twice, and reports it', async () => {
		mocks.runPublishExportInWorker.mockRejectedValue(
			new WorkerRunError('crashed', 'Publish worker crashed')
		)
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'failed',
			failure: { reason: 'worker-stopped', detail: 'Publish worker crashed' }
		})
	})

	it('says the export ran out of time when the worker timed out', async () => {
		mocks.runPublishExportInWorker.mockRejectedValue(
			new WorkerRunError('timed-out', 'Publishing timed out after 600s')
		)
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview?.failure?.reason).toBe(
			'timed-out'
		)
	})

	it('says the model could not be prepared when it cannot be exported', async () => {
		mocks.exportDocumentGLB.mockRejectedValue(new Error('Invalid accessor'))
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview).toMatchObject({
			status: 'failed',
			failure: { reason: 'unprepared', detail: 'Invalid accessor' }
		})
		expect(mocks.runPublishExportInWorker).not.toHaveBeenCalled()
	})

	it('says the model could not be prepared when the baked file will not load', async () => {
		mocks.loadToThreeJS.mockRejectedValue(new Error('Unexpected end of GLB'))
		const { hook } = setup()

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview?.failure).toEqual({
			reason: 'unprepared',
			detail: 'Unexpected end of GLB'
		})
	})

	it('keeps lower detail on the bake’s report, never in the lighting', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: new ArrayBuffer(8),
			occlusion: { ...report, recovered: 'lower-detail' }
		})
		const { store, hook } = setup()
		const lighting = store.get(lightingAtom)

		await act(() => hook.result.current.preview.bake())

		expect(hook.result.current.preview.preview?.reports?.occlusion).toEqual({
			...report,
			recovered: 'lower-detail'
		})
		expect(store.get(lightingAtom)).toBe(lighting)
		expect(hook.result.current.publishExport.request).toMatchObject({
			occlusion: true
		})
		expect(hook.result.current.shown).toBeInstanceOf(Group)
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

describe('showing what a publish exported', () => {
	const outcome = { buffer: new ArrayBuffer(8), occlusion: report }
	const show = (current: BakePreview | null) => {
		const store = createStore()
		store.set(bakePreviewAtom, current)
		const wrapper = ({ children }: { children: ReactNode }) => (
			<Provider store={store}>{children}</Provider>
		)
		const { result } = renderHook(() => useShowPublishedFinish(), { wrapper })
		return { store, show: result.current }
	}
	const source = { document: {}, passRevision: 0, bakes: 'published' }

	it('leaves a preview of other lights, asked for since, in place', async () => {
		const newer: BakePreview = {
			status: 'baking',
			source: { ...source, bakes: 'moved a light' },
			shown: true
		}
		const { store, show: showFinish } = show(newer)

		await act(() => showFinish(source, outcome as never))

		expect(store.get(bakePreviewAtom)).toBe(newer)
		expect(mocks.disposeModel).toHaveBeenCalledOnce()
	})

	it('keeps a preview of the same export hidden when the author hid it', async () => {
		const { store, show: showFinish } = show({
			status: 'ready',
			source,
			shown: false
		})

		await act(() => showFinish(source, outcome as never))

		expect(store.get(bakePreviewAtom)).toMatchObject({
			status: 'ready',
			shown: false,
			outcome
		})
	})
	it('shows a publish whose every bake failed as a failed preview, with why', async () => {
		const failedOutcome = {
			buffer: new ArrayBuffer(8),
			occlusion: { failed: 'no-webgl', detail: 'Error creating WebGL context.' }
		}
		const { store, show: showFinish } = show(null)

		await act(() => showFinish(source, failedOutcome as never))

		expect(store.get(bakePreviewAtom)).toMatchObject({
			status: 'failed',
			source,
			failure: { reason: 'no-webgl', detail: 'Error creating WebGL context.' }
		})
	})

	it('leaves a newer request in place when a published finish failed', async () => {
		const newer: BakePreview = {
			status: 'baking',
			source: { ...source, bakes: 'moved a light' },
			shown: true
		}
		const { store, show: showFinish } = show(newer)

		await act(() =>
			showFinish(source, {
				buffer: new ArrayBuffer(8),
				occlusion: { failed: 'unexpected', detail: 'x' }
			} as never)
		)

		expect(store.get(bakePreviewAtom)).toBe(newer)
	})
})

describe('the finish a save keeps', () => {
	const source = { document: {}, passRevision: 0, bakes: 'k' }
	const outcome = { buffer: new ArrayBuffer(8), occlusion: report }

	it('is the current preview’s file and reports, when every bake worked', () => {
		expect(
			studioFinishToSave({
				status: 'ready',
				source,
				shown: true,
				reports: { occlusion: report },
				outcome: outcome as never
			})
		).toEqual({ bytes: outcome.buffer, reports: { occlusion: report } })
	})

	it('is none when the bakes drew nothing, which leaves nothing to show', () => {
		const nothing = {
			baked: [],
			skipped: [{ material: 'glass', reason: 'no-uv0' }]
		}
		expect(
			studioFinishToSave({
				status: 'ready',
				source,
				shown: true,
				reports: { occlusion: nothing as never },
				outcome: { ...outcome, occlusion: nothing } as never
			})
		).toBeUndefined()
	})

	it('is none without a current preview, which keeps the stored one', () => {
		expect(studioFinishToSave(null)).toBeUndefined()
	})

	it('keeps the stored finish while its restored preview is current', () => {
		expect(
			studioFinishToSave({
				status: 'ready',
				source,
				shown: true,
				reports: { occlusion: report },
				restored: true
			})
		).toBeUndefined()
	})
})

describe('restoring the finish saved with the scene', () => {
	const lighting = { occlusion: { mode: 'baked' as const } }
	const restore = (
		bakes: string | null,
		prepare: (store: ReturnType<typeof createStore>) => void = () => {}
	) => {
		const store = createStore()
		store.set(lightingAtom, lighting)
		prepare(store)
		const wrapper = ({ children }: { children: ReactNode }) => (
			<Provider store={store}>{children}</Provider>
		)
		renderHook(
			() =>
				useRestoreSavedFinish({
					url: '/api/scenes/s1/assets/finish',
					reports: { occlusion: report },
					bakes
				}),
			{ wrapper }
		)
		return store
	}

	it('shows it once the saved lighting is on screen', async () => {
		const fetchSpy = vi.fn(async () => new Response(new ArrayBuffer(8)))
		vi.stubGlobal('fetch', fetchSpy)

		const store = restore(bakesKey(lighting))

		await waitFor(() =>
			expect(store.get(bakePreviewAtom)).toMatchObject({
				status: 'ready',
				restored: true,
				reports: { occlusion: report }
			})
		)
		expect(fetchSpy).toHaveBeenCalledWith('/api/scenes/s1/assets/finish')
		vi.unstubAllGlobals()
	})

	it('waits while the lighting on screen is not the one it was saved for', async () => {
		const fetchSpy = vi.fn()
		vi.stubGlobal('fetch', fetchSpy)

		const store = restore('{"occlusion":false,"lights":"other"}')
		await act(async () => {})

		expect(fetchSpy).not.toHaveBeenCalled()
		expect(store.get(bakePreviewAtom)).toBeNull()
		vi.unstubAllGlobals()
	})

	it('waits while the scene has changes since it opened', async () => {
		const fetchSpy = vi.fn()
		vi.stubGlobal('fetch', fetchSpy)

		restore(bakesKey(lighting), (store) =>
			store.set(processAtom, (state) => ({ ...state, hasUnsavedChanges: true }))
		)
		await act(async () => {})

		expect(fetchSpy).not.toHaveBeenCalled()
		vi.unstubAllGlobals()
	})

	it('waits while an optimization pass is newer than the saved one', async () => {
		const fetchSpy = vi.fn()
		vi.stubGlobal('fetch', fetchSpy)

		restore(bakesKey(lighting), (store) =>
			store.set(optimizationRuntimeAtom, (runtime) => ({
				...runtime,
				passRevision: 1
			}))
		)
		await act(async () => {})

		expect(fetchSpy).not.toHaveBeenCalled()
		vi.unstubAllGlobals()
	})

	it('restores once: a finish cleared later is not brought back', async () => {
		const fetchSpy = vi.fn(async () => new Response(new ArrayBuffer(8)))
		vi.stubGlobal('fetch', fetchSpy)

		const store = restore(bakesKey(lighting))
		await waitFor(() =>
			expect(store.get(bakePreviewAtom)).toMatchObject({ restored: true })
		)
		await act(async () => store.set(bakePreviewAtom, null))

		expect(fetchSpy).toHaveBeenCalledTimes(1)
		expect(store.get(bakePreviewAtom)).toBeNull()
		vi.unstubAllGlobals()
	})
})
