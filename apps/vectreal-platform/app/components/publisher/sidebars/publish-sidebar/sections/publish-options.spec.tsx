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
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../../../lib/stores/scene-optimization-store'
import { presentationAtom } from '../../../../../lib/stores/scene-settings-store'

import type { Optimizations } from '@vctrl/core'

const mocks = vi.hoisted(() => ({
	getDocument: vi.fn(),
	toastSuccess: vi.fn(),
	runPublishExportInWorker: vi.fn(),
	publishSceneFromGlb: vi.fn(),
	toastWarning: vi.fn()
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		optimizer: { isReady: true, _getDocument: mocks.getDocument },
		file: { name: 'shoe.glb' }
	})
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
vi.mock('../../../../../lib/domain/scene/client/publish-export', () => ({
	runPublishExportInWorker: mocks.runPublishExportInWorker
}))
vi.mock('../../../../../lib/domain/scene/client/scene-publish', () => ({
	publishSceneFromGlb: mocks.publishSceneFromGlb
}))
vi.mock('../../../../publishing/scene-publish-state-control', () => ({
	ScenePublishStateControl: ({ onPublish }: { onPublish: () => void }) => (
		<button onClick={onPublish}>Publish Scene</button>
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
				onProgress({ texturesDone: 0, texturesTotal: 2 })
				return new Promise((resolve) => {
					finish = resolve
				})
			}
		)
		renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		expect(
			await screen.findByText(/Compressing textures for the GPU \(1 of 2\)/)
		).toBeInTheDocument()

		finish({ buffer: PUBLISHED.slice().buffer, geometryCodec: 'none' })
		await waitFor(() => expect(mocks.publishSceneFromGlb).toHaveBeenCalled())

		// A second publish that has not reported yet shows no stale count.
		mocks.runPublishExportInWorker.mockImplementation(
			() => new Promise(() => {})
		)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))
		expect(
			await screen.findByText('Publishing optimized scene...')
		).toBeInTheDocument()
		expect(screen.queryByText(/Compressing textures/)).toBeNull()
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
		expect(published.currentSceneBytes).toBe(PUBLISHED.byteLength)
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

	it('leaves the figures to a pass that replaced the document during the upload', async () => {
		mocks.publishSceneFromGlb.mockImplementation(async () => {
			mocks.getDocument.mockImplementation(() => new Document())
			return {
				response: {},
				publishState: { sceneId: 'scene-1', status: 'published' }
			}
		})
		const store = renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled())
		expect(store.get(optimizationRuntimeAtom)).toMatchObject({
			optimizedTextureBytes: null,
			publishedEncoding: null
		})
	})

	it('leaves the figures to a pass still running when the upload lands', async () => {
		const store = renderPanel(balancedPreset)
		mocks.publishSceneFromGlb.mockImplementation(async () => {
			store.set(optimizationRuntimeAtom, (state) => ({
				...state,
				isPending: true
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
})
