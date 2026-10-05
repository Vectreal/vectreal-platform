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
import { optimizationAtom } from '../../../../../lib/stores/scene-optimization-store'
import { presentationAtom } from '../../../../../lib/stores/scene-settings-store'

import type { Optimizations } from '@vctrl/core'

const mocks = vi.hoisted(() => ({
	runPublishExportInWorker: vi.fn(),
	publishSceneFromGlb: vi.fn(),
	toastWarning: vi.fn()
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		optimizer: { isReady: true, _getDocument: () => new Document() },
		file: { name: 'shoe.glb' }
	})
}))
vi.mock('react-router', () => ({
	useNavigate: () => vi.fn(),
	useRevalidator: () => ({ revalidate: vi.fn() })
}))
vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn(), warning: mocks.toastWarning }
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
	compressTexturesForGpu?: boolean
) {
	const store = createStore()
	store.set(optimizationAtom, (state) => ({ ...state, derivedFrom }))
	if (compressTexturesForGpu !== undefined) {
		store.set(presentationAtom, (state) => ({
			...state,
			compressTexturesForGpu
		}))
	}
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
		mocks.runPublishExportInWorker.mockResolvedValue({
			buffer: PUBLISHED.slice().buffer,
			geometryCodec: 'meshopt',
			textures: { encoded: ['color'], kept: [] }
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
		renderPanel(balancedPreset)
		fireEvent.click(screen.getByRole('button', { name: 'Publish Scene' }))

		await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalled())
		expect(mocks.toastWarning).toHaveBeenCalledWith(
			expect.stringContaining('1 texture could not be GPU-compressed'),
			{ description: 'KTX2 was more than 3× its size' }
		)
	})
})
