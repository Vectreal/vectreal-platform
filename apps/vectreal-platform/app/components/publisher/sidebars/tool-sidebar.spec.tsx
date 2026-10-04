// @vitest-environment jsdom
/**
 * A request to open the Camera tool on one camera is for the opening that
 * made it. If the author leaves before the Camera panel mounts (switches tool
 * inside its exit animation, closes the sidebar, enters preview), a later,
 * unrelated visit to the Camera tool must open on the camera list.
 */
import { render } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it } from 'vitest'

import { ToolSidebar } from './tool-sidebar'
import {
	cameraToolOpenRequestAtom,
	openCameraInCameraToolAtom,
	processAtom
} from '../../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	hotspotCameraModeAtom,
	selectedCameraIdAtom
} from '../../../lib/stores/scene-settings-store'
import { PublisherViewerCaptureProvider } from '../publisher-viewer-capture-context'

// The open Camera panel's sliders measure themselves; jsdom has none.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

describe('ToolSidebar', () => {
	it('drops a Camera tool request once the Camera tool is not open', () => {
		const store = createStore()
		store.set(openCameraInCameraToolAtom, 'hotspot-camera-1')
		// The author closes the sidebar before the Camera panel mounted.
		store.set(processAtom, (prev) => ({ ...prev, showSidebar: false }))

		render(
			<Provider store={store}>
				<ToolSidebar />
			</Provider>
		)

		expect(store.get(cameraToolOpenRequestAtom)).toBeNull()
	})

	it('puts back the camera from before once the Camera tool is not open', () => {
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				{ cameraId: 'front', name: 'Front', kind: 'scene', initial: true },
				{ cameraId: 'hotspot-camera-1', name: 'Knob', kind: 'hotspot' }
			]
		})
		store.set(selectedCameraIdAtom, 'front')
		store.set(openCameraInCameraToolAtom, 'hotspot-camera-1')
		// Closed before the Camera panel mounted, so only this can end the mode.
		store.set(processAtom, (prev) => ({ ...prev, showSidebar: false }))

		render(
			<Provider store={store}>
				<ToolSidebar />
			</Provider>
		)

		expect(store.get(hotspotCameraModeAtom)).toBeNull()
		expect(store.get(selectedCameraIdAtom)).toBe('front')
	})
	it('keeps the mode while the Camera tool is the open tool', () => {
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				{ cameraId: 'front', name: 'Front', kind: 'scene', initial: true },
				{ cameraId: 'hotspot-camera-1', name: 'Knob', kind: 'hotspot' }
			]
		})
		store.set(selectedCameraIdAtom, 'front')
		store.set(openCameraInCameraToolAtom, 'hotspot-camera-1')

		render(
			<Provider store={store}>
				<PublisherViewerCaptureProvider>
					<ToolSidebar />
				</PublisherViewerCaptureProvider>
			</Provider>
		)

		expect(store.get(hotspotCameraModeAtom)).not.toBeNull()
		expect(store.get(selectedCameraIdAtom)).toBe('hotspot-camera-1')
	})
})
