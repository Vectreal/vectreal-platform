// @vitest-environment jsdom
/**
 * What the publish panel hands the export worker, and the switch that decides
 * whether textures go to KTX2. The rules are pinned in their own modules; this
 * covers the wiring between them and the panel.
 */
import { Document } from '@gltf-transform/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PublishOptions } from './publish-options'
import {
	balancedPreset,
	originalPreset
} from '../../../../../constants/optimizations'
import { bakePreviewAtom } from '../../../../../lib/stores/publisher-config-store'
import {
	dispatchSaveProgressAtom,
	savePanelAtom
} from '../../../../../lib/stores/save-progress-store'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../../../lib/stores/scene-optimization-store'
import {
	cameraAtom,
	hotspotsAtom,
	lightingAtom,
	presentationAtom
} from '../../../../../lib/stores/scene-settings-store'

import type { Optimizations } from '@vctrl/core'

const mocks = vi.hoisted(() => ({
	getDocument: vi.fn(),
	toastSuccess: vi.fn(),
	runPublishExportInWorker: vi.fn(),
	publishSceneFromGlb: vi.fn(),
	toastWarning: vi.fn(),
	loadToThreeJS: vi.fn()
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		optimizer: { isReady: true, _getDocument: mocks.getDocument },
		file: { name: 'shoe.glb' }
	})
}))
vi.mock('@vctrl/core/model-loader', () => ({
	ModelLoader: class {
		loadToThreeJS = mocks.loadToThreeJS
	}
}))
vi.mock('react-router', () => ({
	useNavigate: () => vi.fn(),
	useRevalidator: () => ({ revalidate: vi.fn() })
}))
vi.mock('sonner', () => ({
	toast: {
		success: mocks.toastSuccess,
		error: vi.fn(),
		warning: mocks.toastWarning
	}
}))
vi.mock(
	'../../../../../lib/domain/scene/client/publish-export',
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		runPublishExportInWorker: mocks.runPublishExportInWorker
	})
)
vi.mock('../../../../../lib/domain/scene/client/scene-publish', () => ({
	publishSceneFromGlb: mocks.publishSceneFromGlb
}))
vi.mock('../../../../publishing/scene-publish-state-control', () => ({
	ScenePublishStateControl: ({
		onPublish,
		onStateChange,
		isPublishActionDisabled
	}: {
		onPublish: () => void
		onStateChange?: (state: { status: 'draft' | 'published' }) => void
		isPublishActionDisabled?: boolean
	}) => (
		<>
			<button onClick={onPublish} disabled={isPublishActionDisabled}>
				Publish Scene
			</button>
			<button onClick={() => onStateChange?.({ status: 'draft' })}>
				Revoke
			</button>
			<button onClick={() => onStateChange?.({ status: 'published' })}>
				Report published
			</button>
		</>
	)
}))

const PUBLISHED = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0])

function renderPanel(
	derivedFrom: Optimizations,
	prepare?: (store: ReturnType<typeof createStore>) => void
) {
	const store = createStore()
	store.set(optimizationAtom, (state) => ({ ...state, derivedFrom }))
	prepare?.(store)
	render(
		<Provider store={store}>
			<PublishOptions
				sceneId="scene-1"
				publishState={{ sceneId: 'scene-1', status: 'draft' } as never}
				saveSceneSettings={vi.fn()}
			/>
		</Provider>
	)
	return store
}

const textureSwitch = () =>
	screen.getByRole('switch', { name: /GPU-compressed textures/ })

describe('the publish panel', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		const document = new Document()
		mocks.getDocument.mockImplementation(() => document)
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: PUBLISHED.slice().buffer,
			geometryCodec: 'meshopt',
			geometrySizes: { none: 300, meshopt: 120, draco: 110 },
			textureBytes: 4321,
			textures: {
				encoded: ['color', 'emissive'],
				kept: []
			}
		})
		mocks.publishSceneFromGlb.mockResolvedValue({
			response: {},
			publishState: { sceneId: 'scene-1', status: 'published' }
		})
	})

	it('compresses textures by default on an optimizing preset', () => {
		renderPanel(balancedPreset)
		expect(textureSwitch()).toBeChecked()
	})

	it('leaves textures alone by default on the original preset', () => {
		renderPanel(originalPreset)
		expect(textureSwitch()).not.toBeChecked()
	})

	it('stores the author’s choice as a presentation setting', () => {
		const store = renderPanel(originalPreset)
		fireEvent.click(textureSwitch())
		expect(store.get(presentationAtom).compressTexturesForGpu).toBe(true)
		expect(textureSwitch()).toBeChecked()
	})

	it("offers the way back from a hotspot's camera only once one exists", () => {
		renderPanel(balancedPreset)
		expect(
			screen.getByRole('switch', { name: /Back to scene view/ })
		).toBeDisabled()
	})

	it("hides the way back from a hotspot's camera when switched off", () => {
		const store = renderPanel(balancedPreset, (store) => {
			store.set(cameraAtom, {
				cameras: [
					{ cameraId: 'front', name: 'Front' },
					{ cameraId: 'knob-camera', kind: 'hotspot', name: 'Knob' }
				]
			})
			store.set(hotspotsAtom, [
				{
					id: 'knob',
					name: 'Knob',
					worldPosition: [0, 0, 0],
					linkedCameraId: 'knob-camera'
				} as never
			])
		})
		const toggle = screen.getByRole('switch', { name: /Back to scene view/ })
		expect(toggle).toBeChecked()
		fireEvent.click(toggle)
		expect(store.get(presentationAtom).showSceneViewReturn).toBe(false)
	})

	it('forgets the choice once it is switched back to the default', () => {
		const store = renderPanel(balancedPreset)
		fireEvent.click(textureSwitch())
		fireEvent.click(textureSwitch())
		expect(store.get(presentationAtom)).not.toHaveProperty(
			'compressTexturesForGpu'
		)
	})

	it('leaves Draco unmeasured when the optimizer found it not worth applying', async () => {
		renderPanel(balancedPreset, (store) =>
			store.set(optimizationRuntimeAtom, (state) => ({
				...state,
				dracoReport: { isWorthApplying: false } as never
			}))
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())
		expect(mocks.runPublishExportInWorker.mock.calls[0][0]).toMatchObject({
			dracoWorthApplying: false
		})
	})

	it('publishes settings saved before Draco existed without geometry compression', async () => {
		const { draco: _draco, ...withoutDraco } = balancedPreset
		renderPanel(withoutDraco as Optimizations)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())
		expect(mocks.runPublishExportInWorker.mock.calls[0][0]).toMatchObject({
			draco: undefined
		})
	})

	it('counts textures while they encode, and stops once publishing ends', async () => {
		let finish: (value: unknown) => void = () => {}
		mocks.runPublishExportInWorker.mockImplementation(
			(_request, onProgress: (p: object) => void) => {
				onProgress({ stage: 'textures', texturesDone: 0, texturesTotal: 2 })
				return new Promise((resolve) => {
					finish = resolve
				})
			}
		)
		const store = renderPanel(balancedPreset)
		const step = (key: string) =>
			store.get(savePanelAtom)?.publish?.steps.find((s) => s.key === key)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() =>
			expect(step('textures')).toMatchObject({
				state: 'active',
				done: 0,
				total: 2
			})
		)

		finish({ buffer: PUBLISHED.slice().buffer, geometryCodec: 'none' })
		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())
		await waitFor(() =>
			expect(store.get(savePanelAtom)?.status).toBe('published')
		)

		// A second publish that has not reported yet shows no stale count.
		mocks.runPublishExportInWorker.mockImplementation(
			() => new Promise(() => {})
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))
		await waitFor(() =>
			expect(step('export')).toMatchObject({ state: 'active' })
		)
		expect(step('textures')).toBeUndefined()
	})

	it('shows each bake as a step, in the order they run', async () => {
		mocks.runPublishExportInWorker.mockImplementation(
			(_request, onProgress: (p: object) => void) => {
				onProgress({ stage: 'occlusion', fraction: 1 })
				onProgress({ stage: 'lights', fraction: 0.4 })
				return new Promise(() => {})
			}
		)
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() =>
			expect(store.get(savePanelAtom)?.publish?.steps).toMatchObject([
				{ key: 'export', state: 'done' },
				{ key: 'occlusion', state: 'done' },
				{ key: 'lights', state: 'active', done: 0.4, total: 1 },
				{ key: 'upload', state: 'waiting' },
				{ key: 'commit', state: 'waiting' }
			])
		)
	})

	it('reports the upload in bytes, then the commit', async () => {
		const store = renderPanel(balancedPreset)
		let committing = false
		mocks.publishSceneFromGlb.mockImplementation(
			async ({
				onUploadProgress,
				onCommitting
			}: {
				onUploadProgress: (fraction: number) => void
				onCommitting: () => void
			}) => {
				onUploadProgress(0.5)
				const upload = store
					.get(savePanelAtom)
					?.publish?.steps.find((s) => s.key === 'upload')
				expect(upload).toMatchObject({
					state: 'active',
					done: PUBLISHED.byteLength / 2,
					total: PUBLISHED.byteLength
				})
				onCommitting()
				committing =
					store
						.get(savePanelAtom)
						?.publish?.steps.find((s) => s.key === 'commit')?.state === 'active'
				return {
					response: {},
					publishState: { sceneId: 'scene-1', status: 'published' }
				}
			}
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() =>
			expect(store.get(savePanelAtom)?.status).toBe('published')
		)
		expect(committing).toBe(true)
	})

	it('waits out a save before it publishes', () => {
		renderPanel(balancedPreset, (store) =>
			store.set(dispatchSaveProgressAtom, { type: 'preparing' })
		)

		expect(screen.getByRole('button', { name: 'Publish Scene' })).toBeDisabled()
	})

	it('marks the step that failed', async () => {
		const store = renderPanel(balancedPreset)
		mocks.runPublishExportInWorker.mockRejectedValue(new Error('GPU reset'))
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(store.get(savePanelAtom)?.status).toBe('failed'))
		expect(store.get(savePanelAtom)).toMatchObject({
			message: 'GPU reset',
			publish: {
				steps: [
					{ key: 'export', state: 'failed' },
					{ key: 'upload', state: 'waiting' },
					{ key: 'commit', state: 'waiting' }
				]
			}
		})
	})

	it('publishes what the worker encoded, with geometry and texture codecs on', async () => {
		renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())
		const [request] = mocks.runPublishExportInWorker.mock.calls[0]
		expect(request).toMatchObject({
			draco: { method: 'edgebreaker' },
			dracoWorthApplying: true,
			ktx2: true
		})
		expect(request.draco).not.toHaveProperty('enabled')
		expect(request.buffer).toBeInstanceOf(ArrayBuffer)

		const [published] = mocks.publishSceneFromGlb.mock.calls[0]
		expect(Array.from(published.glbData)).toEqual(Array.from(PUBLISHED))
		// The server measures the GLB it stores; the request carries no size.
		expect(published).not.toHaveProperty('currentSceneBytes')
		expect(mocks.toastWarning).not.toHaveBeenCalled()
	})

	it('makes the size figures describe the file that shipped', async () => {
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())
		expect(store.get(optimizationRuntimeAtom)).toMatchObject({
			optimizedSceneBytes: PUBLISHED.byteLength,
			optimizedTextureBytes: 4321,
			publishedEncoding: {
				geometryCodec: 'meshopt',
				geometrySizes: { none: 300, meshopt: 120, draco: 110 },
				ktx2Textures: { encoded: 2, total: 2 }
			}
		})
	})

	it('leaves the figures to a pass started during the upload', async () => {
		const store = renderPanel(balancedPreset)
		mocks.publishSceneFromGlb.mockImplementation(async () => {
			store.set(optimizationRuntimeAtom, (state) => ({
				...state,
				passRevision: state.passRevision + 1
			}))
			return {
				response: { stats: { currentSceneBytes: 8 } },
				publishState: { sceneId: 'scene-1', status: 'published' }
			}
		})
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
		expect(store.get(optimizationRuntimeAtom)).toMatchObject({
			optimizedTextureBytes: null,
			publishedEncoding: null,
			latestSceneStats: { currentSceneBytes: 8 }
		})
	})

	it('leaves the figures to a scene or upload that replaced the document during the upload', async () => {
		const store = renderPanel(balancedPreset)
		mocks.publishSceneFromGlb.mockImplementation(async () => {
			mocks.getDocument.mockImplementation(() => new Document())
			return {
				response: {},
				publishState: { sceneId: 'scene-1', status: 'published' }
			}
		})
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
		expect(store.get(optimizationRuntimeAtom)).toMatchObject({
			optimizedTextureBytes: null,
			publishedEncoding: null
		})
	})

	it('leaves the figures to a pass that was running when Publish was pressed', async () => {
		const store = renderPanel(balancedPreset, (store) =>
			store.set(optimizationRuntimeAtom, (state) => ({
				...state,
				isPending: true
			}))
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
		expect(store.get(optimizationRuntimeAtom).publishedEncoding).toBeNull()
	})

	it('records nothing as shipped when the upload fails', async () => {
		mocks.publishSceneFromGlb.mockRejectedValue(new Error('network down'))
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())
		await screen.findByText('network down')
		expect(store.get(optimizationRuntimeAtom)).toMatchObject({
			optimizedTextureBytes: null,
			publishedEncoding: null
		})
	})

	it('counts no KTX2 textures for a model that has none', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: PUBLISHED.slice().buffer,
			geometryCodec: 'draco',
			textureBytes: 0,
			textures: { encoded: [], kept: [] }
		})
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() =>
			expect(
				store.get(optimizationRuntimeAtom).publishedEncoding
			).not.toBeNull()
		)
		expect(
			store.get(optimizationRuntimeAtom).publishedEncoding
		).not.toHaveProperty('ktx2Textures')
	})

	it('publishes plain geometry and textures for the original preset', async () => {
		renderPanel(originalPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())
		expect(mocks.runPublishExportInWorker.mock.calls[0][0]).toMatchObject({
			draco: undefined,
			ktx2: false
		})
	})

	it('says which textures could not be compressed', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: PUBLISHED.slice().buffer,
			geometryCodec: 'draco',
			textures: {
				encoded: [],
				kept: [{ texture: 'normal', reason: 'KTX2 was more than 3× its size' }]
			}
		})
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalled())
		expect(store.get(optimizationRuntimeAtom).publishedEncoding).toMatchObject({
			ktx2Textures: { encoded: 0, total: 1 }
		})
		expect(mocks.toastWarning).toHaveBeenCalledWith(
			expect.stringContaining('1 texture could not be GPU-compressed'),
			{ description: 'KTX2 was more than 3× its size' }
		)
	})

	it('bakes occlusion only when the lighting says baked', async () => {
		for (const mode of ['off', 'live', 'baked'] as const) {
			renderPanel(balancedPreset, (store) =>
				store.set(lightingAtom, { occlusion: { mode } })
			)
			fireEvent.click(
				screen.getAllByRole('button', { name: 'Publish Scene' }).at(-1)!
			)
		}
		await waitFor(() =>
			expect(mocks.runPublishExportInWorker).toHaveBeenCalledTimes(3)
		)

		expect(
			mocks.runPublishExportInWorker.mock.calls.map(
				([request]) => request.occlusion
			)
		).toEqual([false, false, true])
	})

	it('names a material the bake skipped, and still publishes', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: PUBLISHED.slice().buffer,
			geometryCodec: 'none',
			occlusion: {
				baked: ['body'],
				skipped: [{ material: 'wheel', reason: 'shared-geometry' }]
			}
		})
		renderPanel(balancedPreset, (store) =>
			store.set(lightingAtom, { occlusion: { mode: 'baked' } })
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())
		expect(mocks.toastWarning).toHaveBeenCalledWith(
			"1 material could not take the studio finish's depth.",
			{ description: 'wheel: its mesh is placed more than once' }
		)
	})

	it('says so when the bake failed, and still publishes', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: PUBLISHED.slice().buffer,
			geometryCodec: 'none',
			occlusion: { failed: 'WebGL 2 is unavailable' }
		})
		renderPanel(balancedPreset, (store) =>
			store.set(lightingAtom, { occlusion: { mode: 'baked' } })
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())
		expect(mocks.toastWarning).toHaveBeenCalledWith(
			'The studio finish could not add depth, so the scene was published without it.',
			{ description: 'WebGL 2 is unavailable' }
		)
	})

	it('keeps a bake that failed partway marked failed once the scene ships', async () => {
		mocks.runPublishExportInWorker.mockImplementation(
			async (_request, onProgress: (progress: object) => void) => {
				onProgress({ stage: 'occlusion', fraction: 0.4 })
				onProgress({ stage: 'lights', fraction: 1 })
				return {
					buffer: PUBLISHED.slice().buffer,
					geometryCodec: 'none',
					occlusion: { failed: 'The GPU reset while baking ambient occlusion' },
					lights: { baked: ['body'], skipped: [] }
				}
			}
		)
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() =>
			expect(store.get(savePanelAtom)?.status).toBe('published')
		)
		expect(store.get(savePanelAtom)?.publish?.steps).toMatchObject([
			{ key: 'export', state: 'done' },
			{ key: 'occlusion', state: 'failed' },
			{ key: 'lights', state: 'done' },
			{ key: 'upload', state: 'done' },
			{ key: 'commit', state: 'done' }
		])
	})

	it('shows the finish it published, and ships that file again without exporting', async () => {
		const scene = {}
		mocks.loadToThreeJS.mockResolvedValue({ scene })
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: PUBLISHED.slice().buffer,
			geometryCodec: 'none',
			occlusion: { baked: ['body'], skipped: [] }
		})
		const store = renderPanel(balancedPreset, (store) =>
			store.set(lightingAtom, { occlusion: { mode: 'baked' } })
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() =>
			expect(store.get(bakePreviewAtom)).toMatchObject({
				status: 'ready',
				shown: true,
				model: scene
			})
		)

		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))
		await waitFor(() =>
			expect(mocks.publishSceneFromGlb).toHaveBeenCalledTimes(2)
		)
		expect(mocks.runPublishExportInWorker).toHaveBeenCalledOnce()
		expect(mocks.publishSceneFromGlb.mock.calls[1][0].glbData).toEqual(
			PUBLISHED
		)
	})

	it('bakes again rather than ship a finish one of whose bakes failed', async () => {
		mocks.loadToThreeJS.mockResolvedValue({ scene: {} })
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: PUBLISHED.slice().buffer,
			geometryCodec: 'none',
			occlusion: { baked: ['body'], skipped: [] },
			lights: { failed: 'The GPU reset while baking the studio lights' }
		})
		const store = renderPanel(balancedPreset, (store) =>
			store.set(lightingAtom, {
				occlusion: { mode: 'baked' },
				lights: [{ role: 'key', azimuth: 30 }],
				bake: { lights: true }
			})
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))
		await waitFor(() =>
			expect(store.get(bakePreviewAtom)?.status).toBe('ready')
		)

		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))
		await waitFor(() =>
			expect(mocks.publishSceneFromGlb).toHaveBeenCalledTimes(2)
		)
		expect(mocks.runPublishExportInWorker).toHaveBeenCalledTimes(2)
	})

	it('leaves the model as it is when the publish bakes nothing', async () => {
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() =>
			expect(store.get(savePanelAtom)?.status).toBe('published')
		)
		expect(store.get(bakePreviewAtom)).toBeNull()
		expect(mocks.loadToThreeJS).not.toHaveBeenCalled()
	})

	it('says nothing about the bake when the publish itself fails', async () => {
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: PUBLISHED.slice().buffer,
			geometryCodec: 'none',
			occlusion: { failed: 'WebGL 2 is unavailable' }
		})
		mocks.publishSceneFromGlb.mockRejectedValue(new Error('network down'))
		renderPanel(balancedPreset, (store) =>
			store.set(lightingAtom, { occlusion: { mode: 'baked' } })
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await screen.findByText('network down')
		expect(mocks.toastWarning).not.toHaveBeenCalled()
	})

	// Revoking deletes the published GLB, so its size stops describing the scene.
	it('drops the published size when the publication is revoked', async () => {
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))
		await waitFor(() =>
			expect(
				store.get(optimizationRuntimeAtom).publishedEncoding
			).not.toBeNull()
		)
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			latestSceneStats: { currentSceneBytes: 8 } as never
		}))

		fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

		expect(store.get(optimizationRuntimeAtom)).toMatchObject({
			optimizedSceneBytes: null,
			publishedEncoding: null,
			latestSceneStats: { currentSceneBytes: null }
		})
	})

	// The control reports its new state after every publish too.
	it('keeps the published size when the control reports a publish', async () => {
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))
		await waitFor(() =>
			expect(
				store.get(optimizationRuntimeAtom).publishedEncoding
			).not.toBeNull()
		)
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			latestSceneStats: { currentSceneBytes: 8 } as never
		}))
		const before = store.get(optimizationRuntimeAtom)

		fireEvent.click(screen.getByRole('button', { name: 'Report published' }))

		expect(store.get(optimizationRuntimeAtom)).toMatchObject({
			optimizedSceneBytes: before.optimizedSceneBytes,
			publishedEncoding: before.publishedEncoding,
			latestSceneStats: { currentSceneBytes: 8 }
		})
	})

	// Without a publish this session, the figure on screen is a pass's own.
	it('keeps a pass’s size when a publication it never shipped is revoked', () => {
		const store = renderPanel(balancedPreset)
		store.set(optimizationRuntimeAtom, (prev) => ({
			...prev,
			optimizedSceneBytes: 5,
			publishedEncoding: null,
			latestSceneStats: { currentSceneBytes: 8 } as never
		}))

		fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

		expect(store.get(optimizationRuntimeAtom)).toMatchObject({
			optimizedSceneBytes: 5,
			latestSceneStats: { currentSceneBytes: null }
		})
	})
})
