// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import {
	isPreviewModeAtom,
	viewportControlsAtom
} from '../../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	selectedCameraIdAtom
} from '../../../lib/stores/scene-settings-store'
import {
	PublisherViewerCaptureProvider,
	usePublisherViewerCapture
} from '../publisher-viewer-capture-context'
import { usePreviewToggle } from './use-preview-toggle'

import type { SceneCameraSnapshot } from '@vctrl/viewer'
import type { ReactNode } from 'react'

const view: SceneCameraSnapshot = {
	position: [4, -2, 4],
	rotation: [0, 0, 0],
	target: [1, 1, 1],
	fov: 40,
	framingAspect: 16 / 9,
	viewportAspect: 16 / 9
}

const setup = (snapshot: null | SceneCameraSnapshot) => {
	const store = createStore()
	store.set(cameraAtom, {
		cameras: [
			{ cameraId: 'opening', name: 'Opening', initial: true },
			{ cameraId: 'detail', name: 'Detail' }
		]
	})
	store.set(selectedCameraIdAtom, 'detail')
	const restore = vi.fn()
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>
			<PublisherViewerCaptureProvider>
				{children}
			</PublisherViewerCaptureProvider>
		</Provider>
	)
	const { result } = renderHook(
		() => ({
			toggle: usePreviewToggle(),
			capture: usePublisherViewerCapture()
		}),
		{ wrapper }
	)
	result.current.capture.registerSceneCameraSnapshotCapture(
		async () => snapshot
	)
	result.current.capture.registerSceneCameraSnapshotRestore(restore)
	return { store, restore, toggle: () => result.current.toggle }
}

describe('usePreviewToggle', () => {
	it('puts the view read on entering back on screen on exit', async () => {
		const { store, restore, toggle } = setup(view)

		await act(() => toggle().enterPreview())
		expect(store.get(isPreviewModeAtom)).toBe(true)
		expect(store.get(selectedCameraIdAtom)).toBe('opening')
		expect(restore).not.toHaveBeenCalled()

		act(() => toggle().exitPreview())
		expect(store.get(isPreviewModeAtom)).toBe(false)
		expect(store.get(selectedCameraIdAtom)).toBe('detail')
		expect(restore.mock.calls[0]?.[0]).toBe(view)
		expect(store.get(viewportControlsAtom).maxPolarAngle).toBe(Math.PI)
	})

	it('restores nothing when no view could be read', async () => {
		const { restore, toggle } = setup(null)

		await act(() => toggle().enterPreview())
		act(() => toggle().exitPreview())
		expect(restore).not.toHaveBeenCalled()
	})
})

/**
 * The route is what hands the viewer's restore to the context; without it the
 * hook above restores into nothing and every spec here stays green.
 */
describe('the publisher route wires the restore', () => {
	it('registers the viewer restore with the capture context', () => {
		const route = readFileSync(
			join(
				import.meta.dirname,
				'../../../routes/publisher-page/publisher.$sceneId.tsx'
			),
			'utf8'
		)
		expect(route).toContain(
			'onCameraSnapshotRestoreReady={registerSceneCameraSnapshotRestore}'
		)
	})
})
