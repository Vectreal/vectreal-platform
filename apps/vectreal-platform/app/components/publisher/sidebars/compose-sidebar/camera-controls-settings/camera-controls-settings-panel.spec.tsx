// @vitest-environment jsdom
/**
 * Another tool can send the author here to edit one camera (a hotspot's
 * "Open in Camera tool"). The panel opens on that camera as if its row had
 * been clicked, and takes the request only once.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it } from 'vitest'

import CameraControlsSettingsPanel from './camera-controls-settings-panel'
import {
	cameraToolOpenRequestAtom,
	openCameraInCameraToolAtom
} from '../../../../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	selectedCameraIdAtom
} from '../../../../../lib/stores/scene-settings-store'
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

/**
 * A hotspot's camera picked here is left by stepping out of its view, which
 * puts back the camera the author was on (closing the tool is `ToolSidebar`'s).
 */
describe('CameraControlsSettingsPanel and hotspot cameras', () => {
	const openRow = async (name: string) => {
		fireEvent.click(
			await screen.findByRole('button', { name: new RegExp(name) })
		)
		await screen.findByRole('heading', { name })
	}

	it('puts it back when the author steps out of the camera’s view', async () => {
		const store = sceneWithTwoCameras()
		store.set(selectedCameraIdAtom, 'front')
		renderPanel(store)

		await openRow('Knob Camera')
		fireEvent.click(screen.getByRole('button', { name: 'Back to Camera' }))

		expect(store.get(selectedCameraIdAtom)).toBe('front')
	})

	it('goes back to where the author started when the hotspot camera is deleted', async () => {
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				{ cameraId: 'front', name: 'Front', initial: true },
				{ cameraId: 'side', name: 'Side' },
				{ cameraId: 'hotspot-camera-1', kind: 'hotspot', name: 'Knob Camera' }
			]
		})
		store.set(selectedCameraIdAtom, 'side')
		renderPanel(store)

		await openRow('Knob Camera')
		fireEvent.click(screen.getByRole('button', { name: /Delete/ }))

		// Not the default camera: the one the author was on.
		expect(store.get(selectedCameraIdAtom)).toBe('side')
	})
})
