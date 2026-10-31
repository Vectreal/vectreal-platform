// @vitest-environment jsdom
/**
 * "Set opening view" writes the default camera and the thumbnail from one
 * frame, and records that frame, so a save can upload the image it approved
 * instead of rendering the frame again.
 */
import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import { useOpeningViewCapture } from './use-opening-view'
import { buildThumbnailFrameSignature } from '../../../lib/domain/scene/client/scene-change-detection'
import {
	capturedThumbnailFrameAtom,
	sceneMetaAtom
} from '../../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	environmentAtom,
	lightingAtom,
	normalizationAtom
} from '../../../lib/stores/scene-settings-store'

import type { ReactNode } from 'react'

const DATA_URL = 'data:image/webp;base64,b3BlbmluZw=='
const snapshot = {
	position: [3, 1, 4] as [number, number, number],
	rotation: [0, 0.5, 0] as [number, number, number],
	target: [0, 0, 0] as [number, number, number],
	fov: 40
}

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../publisher-viewer-capture-context', () => ({
	usePublisherViewerCapture: () => ({
		requestSceneCameraSnapshot: async () => snapshot,
		requestSceneScreenshot: async () => DATA_URL
	})
}))

describe('setting the opening view', () => {
	it('records the frame the captured image painted', async () => {
		const store = createStore()
		const environment = { preset: 'studio-key', background: true } as const
		const openingCamera = { cameraId: 'cam-main', name: 'Main', fov: 50 }
		store.set(cameraAtom, { cameras: [openingCamera] })
		store.set(environmentAtom, environment)
		const lighting = {
			environment: { map: 'studio-key', rotation: 30 }
		} as const
		store.set(lightingAtom, lighting)
		const normalization = { enabled: true, maxSize: 3 }
		store.set(normalizationAtom, normalization)
		const wrapper = ({ children }: { children: ReactNode }) => (
			<Provider store={store}>{children}</Provider>
		)

		const { result } = renderHook(() => useOpeningViewCapture(), { wrapper })
		await act(() => result.current.setOpeningView({ announce: false }))

		expect(store.get(sceneMetaAtom).thumbnailUrl).toBe(DATA_URL)
		expect(store.get(capturedThumbnailFrameAtom)).toEqual({
			thumbnailUrl: DATA_URL,
			frame: buildThumbnailFrameSignature({
				camera: { cameras: [{ ...openingCamera, ...snapshot }] },
				environment,
				lighting,
				normalization
			})
		})
	})
})
