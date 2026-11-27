// @vitest-environment jsdom
/**
 * Everything that shapes how a visitor moves lives in the Interaction tool:
 * moving, starting, and getting between cameras.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it } from 'vitest'

import {
	cameraAtom,
	hotspotsAtom,
	presentationAtom
} from '../../../../lib/stores/scene-settings-store'
import { PublisherViewerCaptureProvider } from '../../publisher-viewer-capture-context'
import InteractionControlsSettingsPanel from './interaction-controls-settings-panel'

// The panel's sliders measure themselves; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const renderPanel = (store = createStore()) => {
	render(
		<Provider store={store}>
			<PublisherViewerCaptureProvider>
				<InteractionControlsSettingsPanel />
			</PublisherViewerCaptureProvider>
		</Provider>
	)
	return store
}

const twoViews = () => {
	const store = createStore()
	store.set(cameraAtom, {
		cameras: [
			{ cameraId: 'front', name: 'Front', kind: 'scene' },
			{ cameraId: 'side', name: 'Side', kind: 'scene' }
		]
	})
	return store
}

describe('the Interaction tool, starting', () => {
	it('waits for a tap on a new scene, until the author starts right away', () => {
		const store = renderPanel()
		const start = screen.getByRole('radiogroup', { name: 'Start moving' })
		expect(
			within(start).getByRole('radio', { name: 'After a tap' })
		).toBeChecked()

		fireEvent.click(within(start).getByRole('radio', { name: 'Right away' }))
		expect(store.get(presentationAtom).interactionStart).toBe('immediate')
	})

	it('shows visitors how to interact on a new scene, until the author turns it off', () => {
		const store = renderPanel()
		const toggle = screen.getByRole('switch', { name: /Show how to interact/ })
		expect(toggle).toBeChecked()
		fireEvent.click(toggle)
		expect(store.get(presentationAtom).showInteractionHint).toBe(false)
	})
})

describe('the Interaction tool, between cameras', () => {
	const switcher = () => screen.getByRole('switch', { name: /Camera switcher/ })

	it('turns the camera switcher off and on, keeping the cameras', () => {
		const store = renderPanel(twoViews())

		expect(switcher()).toBeChecked()
		fireEvent.click(switcher())
		expect(store.get(cameraAtom).showControls).toBe(false)
		expect(store.get(cameraAtom).cameras?.map((c) => c.cameraId)).toEqual([
			'front',
			'side'
		])

		fireEvent.click(switcher())
		expect(store.get(cameraAtom).showControls).toBe(true)
	})

	it('offers no switcher when the second camera is a hotspot’s close-up', () => {
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				{ cameraId: 'front', name: 'Front' },
				{ cameraId: 'hotspot-camera-1', kind: 'hotspot', name: 'Knob' }
			]
		})
		renderPanel(store)
		expect(switcher()).toBeDisabled()
	})

	/*
	  Cameras saved before the publisher tagged them carry no `kind`, so the
	  hotspot link is what marks a close-up, read on what a visitor's viewer
	  gets, which never includes an internal-only hotspot.
	*/
	const untaggedLink = (internalOnly: boolean) => {
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				{ cameraId: 'front', name: 'Front' },
				{ cameraId: 'side', name: 'Side' }
			]
		})
		store.set(hotspotsAtom, [
			{
				id: '00000000-0000-4000-8000-000000000001',
				name: 'Knob',
				worldPosition: [0, 0, 0],
				visible: true,
				internalOnly,
				stylePreset: 'dot',
				linkedCameraId: 'side'
			}
		])
		return store
	}

	it('counts an untagged camera a hotspot links as that hotspot’s close-up', () => {
		renderPanel(untaggedLink(false))
		expect(switcher()).toBeDisabled()
	})

	it('counts it as a view when only an internal hotspot links it', () => {
		renderPanel(untaggedLink(true))
		expect(switcher()).not.toBeDisabled()
	})

	it('opens the transitions', async () => {
		renderPanel(twoViews())
		fireEvent.click(screen.getByRole('button', { name: /Transitions/ }))
		expect(
			await screen.findByRole('heading', { name: 'Transitions' })
		).toBeTruthy()
		expect(screen.getByRole('radio', { name: 'Smart' })).toBeTruthy()
	})

	it("offers the way back from a hotspot's camera only once one exists", () => {
		renderPanel(twoViews())
		expect(
			screen.getByRole('switch', { name: /Back to scene view/ })
		).toBeDisabled()
	})

	it("hides the way back from a hotspot's camera when switched off", () => {
		const store = createStore()
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
		renderPanel(store)
		const toggle = screen.getByRole('switch', { name: /Back to scene view/ })
		expect(toggle).toBeChecked()
		fireEvent.click(toggle)
		expect(store.get(presentationAtom).showSceneViewReturn).toBe(false)
	})
})

describe('the Interaction tool, moving', () => {
	it('leaves zoom and angle limits to each camera, and says so', () => {
		renderPanel()
		expect(screen.queryByRole('switch', { name: /^Zoom/ })).toBeNull()
		expect(screen.queryByRole('button', { name: /^Advanced/ })).toBeNull()
		expect(
			screen.getByText(/Zoom, pan and angle limits are set on each camera\./)
		).toBeTruthy()
	})
})
