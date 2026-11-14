// @vitest-environment jsdom
/**
 * How the studio finish is planned before any preview, kept to the document
 * and pass it was planned from, and how it decides which bakes run. The
 * planning itself runs in the publish worker, mocked here.
 */
import { format } from 'node:util'

import { act, renderHook, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePublishExport } from './use-bake-preview'
import {
	usePlanStudioFinish,
	useStudioFinishPlan
} from './use-studio-finish-plan'
import { studioFinishPlanAtom } from '../../../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../../../lib/stores/scene-optimization-store'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'

import type { StudioFinishPlan } from '../../../../../workers/publish-export.worker.types'
import type { ReactNode } from 'react'
import type { MockInstance } from 'vitest'

const mocks = vi.hoisted(() => ({
	document: {} as object | null,
	planStudioFinishInWorker: vi.fn(),
	exportDocumentGLB: vi.fn()
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
vi.mock(
	'../../../../../lib/domain/scene/client/publish-export',
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		planStudioFinishInWorker: mocks.planStudioFinishInWorker
	})
)

const takes = { baked: ['body'], skipped: [] }
const takesNothing = {
	baked: [],
	skipped: [{ material: 'body', reason: 'tiling-uvs' as const }]
}
const depthOnly: StudioFinishPlan = { occlusion: takes, lights: takesNothing }
const neither: StudioFinishPlan = {
	occlusion: takesNothing,
	lights: takesNothing
}
const litLighting = {
	occlusion: { mode: 'baked' as const },
	lights: [{ role: 'key' as const, azimuth: 30 }],
	bake: { lights: true }
}

/** A promise the test settles when it chooses. */
function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => {
		resolve = done
	})
	return { promise, resolve }
}

function setup() {
	const store = createStore()
	store.set(lightingAtom, litLighting)
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const hook = renderHook(
		() => {
			usePlanStudioFinish()
			return {
				plan: useStudioFinishPlan(),
				publishExport: usePublishExport()
			}
		},
		{ wrapper }
	)
	const setPassRevision = (passRevision: number, isPending = false) =>
		act(() =>
			store.set(optimizationRuntimeAtom, (prev) => ({
				...prev,
				passRevision,
				isPending
			}))
		)
	return { store, hook, setPassRevision }
}

let consoleWarn: MockInstance<typeof console.warn>
beforeEach(() => {
	vi.clearAllMocks()
	mocks.document = {}
	mocks.exportDocumentGLB.mockResolvedValue({ data: new Uint8Array(4) })
	mocks.planStudioFinishInWorker.mockResolvedValue(depthOnly)
	consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
	/* A plan that fails is logged. That, and nothing else. */
	for (const args of consoleWarn.mock.calls) {
		expect(format(...args)).toMatch(/^Planning the studio finish failed:/)
	}
})

describe('planning the studio finish', () => {
	it('plans the document once it loads, from its GLB', async () => {
		const { hook } = setup()

		await waitFor(() => expect(hook.result.current.plan).toEqual(depthOnly))
		expect(mocks.planStudioFinishInWorker).toHaveBeenCalledOnce()
		expect(mocks.planStudioFinishInWorker).toHaveBeenCalledWith(
			expect.any(Uint8Array)
		)
	})

	it('runs no bake the plan says nothing can take, before and at publish', async () => {
		const { hook } = setup()
		// Until the plan lands, every bake asked for runs, as before.
		expect(hook.result.current.publishExport.finishRequest).toMatchObject({
			occlusion: true,
			lights: expect.objectContaining({ lights: expect.any(Array) })
		})
		const keyBefore = hook.result.current.publishExport.finishKey

		await waitFor(() => expect(hook.result.current.plan).toEqual(depthOnly))

		expect(hook.result.current.publishExport.finishRequest).toMatchObject({
			occlusion: true,
			lights: false
		})
		expect(hook.result.current.publishExport.bakesAnything).toBe(true)
		// The same file either way, so a preview made before it stays current.
		expect(hook.result.current.publishExport.finishKey).toBe(keyBefore)
	})

	it('asks for no bake at all when no material can take either', async () => {
		mocks.planStudioFinishInWorker.mockResolvedValue(neither)
		const { hook } = setup()

		await waitFor(() => expect(hook.result.current.plan).toEqual(neither))

		expect(hook.result.current.publishExport.bakesAnything).toBe(false)
	})

	it('never applies a plan for an earlier pass that lands after a later one', async () => {
		const first = deferred<StudioFinishPlan>()
		mocks.planStudioFinishInWorker
			.mockReturnValueOnce(first.promise)
			.mockResolvedValueOnce(depthOnly)
		const { hook, store, setPassRevision } = setup()
		await waitFor(() =>
			expect(mocks.planStudioFinishInWorker).toHaveBeenCalledOnce()
		)

		setPassRevision(1)
		await waitFor(() => expect(hook.result.current.plan).toEqual(depthOnly))
		await act(async () => first.resolve(neither))

		expect(hook.result.current.plan).toEqual(depthOnly)
		expect(store.get(studioFinishPlanAtom)?.source.passRevision).toBe(1)
	})

	it('reads no plan made for another document or pass', async () => {
		const { hook, store, setPassRevision } = setup()
		await waitFor(() => expect(hook.result.current.plan).toEqual(depthOnly))

		// The plan for pass 0 says nothing about pass 1 while it plans, and
		// is let go of.
		mocks.planStudioFinishInWorker.mockReturnValue(new Promise(() => {}))
		setPassRevision(1)
		expect(hook.result.current.plan).toBeNull()
		expect(store.get(studioFinishPlanAtom)).toBeNull()
		expect(hook.result.current.publishExport.finishRequest).toMatchObject({
			lights: expect.objectContaining({ lights: expect.any(Array) })
		})
	})

	it('waits for a pass to settle, since it rewrites the document', async () => {
		mocks.planStudioFinishInWorker.mockReturnValue(new Promise(() => {}))
		const { setPassRevision } = setup()
		await waitFor(() =>
			expect(mocks.planStudioFinishInWorker).toHaveBeenCalledOnce()
		)

		setPassRevision(1, true)
		await act(async () => {})

		expect(mocks.exportDocumentGLB).toHaveBeenCalledOnce()
		expect(mocks.planStudioFinishInWorker).toHaveBeenCalledOnce()
	})

	it('works as before when planning fails', async () => {
		mocks.planStudioFinishInWorker.mockRejectedValue(new Error('crashed'))
		const { hook } = setup()
		await waitFor(() =>
			expect(mocks.planStudioFinishInWorker).toHaveBeenCalledOnce()
		)

		await waitFor(() =>
			expect(console.warn).toHaveBeenCalledWith(
				'Planning the studio finish failed:',
				expect.any(Error)
			)
		)
		expect(hook.result.current.plan).toBeNull()
		expect(hook.result.current.publishExport.finishRequest).toMatchObject({
			occlusion: true
		})
	})

	it('reads no stored plan made for another document at the same pass', async () => {
		const { hook, store } = setup()
		await waitFor(() => expect(hook.result.current.plan).toEqual(depthOnly))

		act(() =>
			store.set(studioFinishPlanAtom, {
				source: { document: {}, passRevision: 0 },
				plan: neither
			})
		)

		expect(hook.result.current.plan).toBeNull()
	})

	it('reads no plan made for another document, and lets go of it', async () => {
		const { hook, store } = setup()
		await waitFor(() => expect(hook.result.current.plan).toEqual(depthOnly))

		// Another model at the same pass, whose plan never lands.
		mocks.planStudioFinishInWorker.mockRejectedValue(new Error('crashed'))
		mocks.document = {}
		hook.rerender()

		expect(hook.result.current.plan).toBeNull()
		await waitFor(() => expect(store.get(studioFinishPlanAtom)).toBeNull())
	})

	it('lets go of the plan, and its document, with the publisher', async () => {
		const { hook, store } = setup()
		await waitFor(() => expect(hook.result.current.plan).toEqual(depthOnly))

		hook.unmount()

		expect(store.get(studioFinishPlanAtom)).toBeNull()
	})
})
