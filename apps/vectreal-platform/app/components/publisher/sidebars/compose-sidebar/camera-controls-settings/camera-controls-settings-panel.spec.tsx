// @vitest-environment jsdom
/**
 * Another tool can send the author here to edit one camera (a hotspot's
 * "Open in Camera tool"). The panel opens on that camera as if its row had
 * been clicked, and takes the request only once.
 */
import { render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it } from 'vitest'

import CameraControlsSettingsPanel from './camera-controls-settings-panel'
import {
	cameraToolOpenRequestAtom,
	openCameraInCameraToolAtom
} from '../../../../../lib/stores/publisher-config-store'
import { cameraAtom } from '../../../../../lib/stores/scene-settings-store'
import { PublisherViewerCaptureProvider } from '../../../publisher-viewer-capture-context'

// The camera view's sliders measure themselves; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const renderPanel = (store: ReturnType<typeof createStore>) =>
	render(
		<Provider store={store}>
			<PublisherViewerCaptureProvider>
				<CameraControlsSettingsPanel />
			</PublisherViewerCaptureProvider>
		</Provider>
	)

const sceneWithTwoCameras = () => {
	const store = createStore()
	store.set(cameraAtom, {
		cameras: [
			{ cameraId: 'front', name: 'Front' },
			{ cameraId: 'hotspot-camera-1', kind: 'hotspot', name: 'Knob Camera' }
		]
	})
	return store
}

describe('CameraControlsSettingsPanel', () => {
	it('opens on the camera another tool sent the author to', async () => {
		const store = sceneWithTwoCameras()
		store.set(openCameraInCameraToolAtom, 'hotspot-camera-1')

		renderPanel(store)

		expect(
			await screen.findByRole('heading', { name: 'Knob Camera' })
		).toBeTruthy()
		expect(store.get(cameraToolOpenRequestAtom)).toBeNull()
	})

	it('opens on the camera list when nothing sent the author here', () => {
		const store = sceneWithTwoCameras()

		renderPanel(store)

		expect(screen.getByRole('button', { name: /Knob Camera/ })).toBeTruthy()
		expect(screen.queryByRole('heading', { name: 'Knob Camera' })).toBeNull()
	})
})
