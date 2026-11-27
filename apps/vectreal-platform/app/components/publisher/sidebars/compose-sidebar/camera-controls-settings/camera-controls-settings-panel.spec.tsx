// @vitest-environment jsdom
/**
 * Another tool can send the author here to edit one camera (a hotspot's
 * "Open in Camera tool"). The panel opens on that camera as if its row had
 * been clicked, and takes the request only once.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
	cameraToolOpenRequestAtom,
	openCameraInCameraToolAtom,
	viewLensAtom,
	viewMovedAtom
} from '../../../../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	hotspotsAtom,
	interactionsAtom,
	selectedCameraIdAtom
} from '../../../../../lib/stores/scene-settings-store'
import {
	PublisherViewerCaptureProvider,
	usePublisherViewerCapture
} from '../../../publisher-viewer-capture-context'
import CameraControlsSettingsPanel from './camera-controls-settings-panel'

import type { SceneCameraSnapshot } from '@vctrl/viewer'

const { toastInfo } = vi.hoisted(() => ({ toastInfo: vi.fn() }))
vi.mock('sonner', () => ({
	toast: { info: toastInfo, success: vi.fn(), error: vi.fn() }
}))

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
			await screen.findByRole('button', { name: new RegExp(`^${name}`) })
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

/**
 * Deleting a camera takes what pointed at it along: hotspot links and the
 * interactions that switched to it. Both would otherwise fail the next save.
 */
describe('CameraControlsSettingsPanel deleting a camera', () => {
	const sceneWithLinkedSide = () => {
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				{ cameraId: 'front', name: 'Front', initial: true },
				{ cameraId: 'side', name: 'Side' }
			]
		})
		store.set(hotspotsAtom, [
			{
				id: 'knob',
				name: 'Knob',
				worldPosition: [0, 0, 0],
				visible: true,
				internalOnly: false,
				stylePreset: 'dot',
				linkedCameraId: 'side'
			}
		])
		store.set(interactionsAtom, [
			{
				id: 'to-side',
				trigger: { source: 'viewer', type: 'viewer_ready' },
				actions: [{ type: 'activate_camera', cameraId: 'side' }]
			},
			{
				id: 'to-front',
				trigger: { source: 'viewer', type: 'viewer_ready' },
				actions: [{ type: 'activate_camera', cameraId: 'front' }]
			}
		])
		return store
	}

	it('drops the interactions that switched to it and says what it took', async () => {
		toastInfo.mockClear()
		const store = sceneWithLinkedSide()
		renderPanel(store)

		fireEvent.click(await screen.findByRole('button', { name: /^Side/ }))
		await screen.findByRole('heading', { name: 'Side' })
		fireEvent.click(screen.getByRole('button', { name: /Delete/ }))

		expect(store.get(interactionsAtom)?.map((i) => i.id)).toEqual(['to-front'])
		expect(store.get(hotspotsAtom)[0].linkedCameraId).toBeUndefined()
		expect(toastInfo).toHaveBeenCalledWith(
			'Camera deleted. "Knob" no longer has a camera. 1 interaction no longer switches to it.'
		)
	})

	// The id stays the one the camera was created with, so what names it
	// (hotspot links, interactions, an embed host's activate_camera) still does.
	it('keeps the camera id and everything linked to it on rename', async () => {
		const store = sceneWithLinkedSide()
		renderPanel(store)
		const linksBefore = {
			interactions: store.get(interactionsAtom),
			hotspots: store.get(hotspotsAtom)
		}

		fireEvent.click(await screen.findByRole('button', { name: /^Side/ }))
		await screen.findByRole('heading', { name: 'Side' })
		const name = screen.getByPlaceholderText('Enter camera name...')
		fireEvent.change(name, { target: { value: 'Profile' } })
		fireEvent.keyDown(name, { key: 'Enter' })

		const renamed = store
			.get(cameraAtom)
			.cameras?.find((c) => c.name === 'Profile')
		expect(renamed?.cameraId).toBe('side')
		expect(store.get(selectedCameraIdAtom)).toBe('side')
		expect(store.get(interactionsAtom)).toBe(linksBefore.interactions)
		expect(store.get(hotspotsAtom)).toBe(linksBefore.hotspots)
	})

	it('says nothing when the camera took nothing with it', async () => {
		toastInfo.mockClear()
		const store = sceneWithLinkedSide()
		store.set(hotspotsAtom, [])
		store.set(interactionsAtom, [])
		renderPanel(store)

		fireEvent.click(await screen.findByRole('button', { name: /^Side/ }))
		await screen.findByRole('heading', { name: 'Side' })
		fireEvent.click(screen.getByRole('button', { name: /Delete/ }))

		expect(store.get(cameraAtom).cameras?.map((c) => c.cameraId)).toEqual([
			'front'
		])
		expect(toastInfo).not.toHaveBeenCalled()
	})
})

/**
 * The view moved off the selected camera: the panel offers to save it, and a
 * lens tried out on it stays off the camera until then.
 */
describe('CameraControlsSettingsPanel with a moved view', () => {
	const snapshot: SceneCameraSnapshot = {
		position: [4, 4, 4],
		rotation: [0, 0, 0],
		target: [1, 1, 1],
		fov: 35,
		framingAspect: 16 / 9,
		viewportAspect: 16 / 9
	}

	/** Stands in for the viewer: its capture and its command executor. */
	function FakeViewer({ execute }: { execute: (command: unknown) => void }) {
		const capture = usePublisherViewerCapture()
		useEffect(() => {
			capture.registerSceneCameraSnapshotCapture(async () => snapshot)
			capture.registerCommandExecutor({ execute })
		}, [capture, execute])
		return null
	}

	const renderMoved = async (moved: boolean) => {
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				{ cameraId: 'front', name: 'Front', fov: 50 },
				{ cameraId: 'side', name: 'Side', fov: 50 }
			]
		})
		const execute = vi.fn()
		render(
			<Provider store={store}>
				<PublisherViewerCaptureProvider>
					<FakeViewer execute={execute} />
					<CameraControlsSettingsPanel />
				</PublisherViewerCaptureProvider>
			</Provider>
		)
		fireEvent.click(await screen.findByRole('button', { name: /^Side/ }))
		await screen.findByRole('heading', { name: 'Side' })
		act(() => store.set(viewMovedAtom, moved))
		return { store, execute }
	}

	const sideFov = (store: ReturnType<typeof createStore>) =>
		store.get(cameraAtom).cameras?.find((c) => c.cameraId === 'side')?.fov

	it('offers nothing to save while the view is on the camera', async () => {
		await renderMoved(false)
		expect(
			screen.queryByRole('button', { name: 'Save as new camera' })
		).toBeNull()
		expect(screen.queryByRole('button', { name: /to this view/ })).toBeNull()
	})

	it('tries a lens out on the view, not the camera', async () => {
		const { store } = await renderMoved(true)
		const slider = screen.getByRole('slider', { name: 'Field of view' })
		fireEvent.keyDown(slider, { key: 'ArrowRight' })

		expect(store.get(viewLensAtom)).toBe(51)
		expect(sideFov(store)).toBe(50)
	})

	it('writes the view into the camera on Update', async () => {
		const { store } = await renderMoved(true)
		fireEvent.click(
			screen.getByRole('button', { name: 'Update “Side” to this view' })
		)

		await waitFor(() => expect(store.get(viewMovedAtom)).toBe(false))
		const side = store
			.get(cameraAtom)
			.cameras?.find((c) => c.cameraId === 'side')
		expect(side?.position).toEqual(snapshot.position)
		expect(side?.fov).toBe(35)
	})

	it('saves the view as a new camera', async () => {
		const { store } = await renderMoved(true)
		fireEvent.click(screen.getByRole('button', { name: 'Save as new camera' }))

		await waitFor(() => expect(store.get(cameraAtom).cameras).toHaveLength(3))
		expect(store.get(cameraAtom).cameras?.[2]).toMatchObject({
			position: snapshot.position,
			fov: 35
		})
	})

	it('flies back to the camera as saved', async () => {
		const { execute } = await renderMoved(true)
		fireEvent.click(screen.getByRole('button', { name: 'Back to camera' }))

		expect(execute).toHaveBeenCalledWith({
			type: 'activate_camera',
			cameraId: 'side'
		})
	})
})

/**
 * The author's say over the viewer's camera switcher. It counts views the way
 * the viewer does - a hotspot's close-up is not one - so it is only on offer
 * where the viewer would draw a switcher at all.
 */
describe('CameraControlsSettingsPanel and the camera switcher', () => {
	const switcher = () => screen.getByRole('switch', { name: /Camera switcher/ })

	const sceneWithTwoViews = () => {
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				{ cameraId: 'front', name: 'Front', kind: 'scene' },
				{ cameraId: 'side', name: 'Side', kind: 'scene' }
			]
		})
		return store
	}

	it('is on by default, and turning it off writes the author’s choice', () => {
		const store = sceneWithTwoViews()
		renderPanel(store)

		expect(switcher().getAttribute('aria-checked')).toBe('true')
		fireEvent.click(switcher())
		expect(store.get(cameraAtom).showControls).toBe(false)

		fireEvent.click(switcher())
		expect(store.get(cameraAtom).showControls).toBe(true)
	})

	it('keeps the cameras when it writes', () => {
		const store = sceneWithTwoViews()
		renderPanel(store)

		fireEvent.click(switcher())
		expect(
			store.get(cameraAtom).cameras?.map((camera) => camera.cameraId)
		).toEqual(['front', 'side'])
	})

	it('is not on offer when the second camera is a hotspot’s close-up', () => {
		renderPanel(sceneWithTwoCameras())

		expect(switcher().hasAttribute('disabled')).toBe(true)
	})

	/*
	  Cameras saved before the publisher tagged them carry no `kind`, so the
	  hotspot link is what marks a close-up - and it has to be read on what a
	  visitor's viewer gets, which never includes an internal-only hotspot.
	*/
	const sceneWithUntaggedLink = (internalOnly: boolean) => {
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
		renderPanel(sceneWithUntaggedLink(false))

		expect(switcher().hasAttribute('disabled')).toBe(true)
	})

	it('counts it as a view when only an internal hotspot links it', () => {
		renderPanel(sceneWithUntaggedLink(true))

		expect(switcher().hasAttribute('disabled')).toBe(false)
	})
})

/**
 * The list is the switcher's order: scene cameras reorder by their handle,
 * the first is the opening view, and a hotspot's camera sits after them
 * without a handle, since it is not in that order.
 */
describe('CameraControlsSettingsPanel ordering the cameras', () => {
	const sceneWithCameras = () => {
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				// A hotspot camera ahead of the scene cameras, as older scenes store it.
				{ cameraId: 'knob', kind: 'hotspot', name: 'Knob Camera' },
				{ cameraId: 'front', name: 'Front' },
				{ cameraId: 'side', name: 'Side' },
				{ cameraId: 'top', name: 'Top' }
			]
		})
		return store
	}

	const storedOrder = (store: ReturnType<typeof createStore>) =>
		(store.get(cameraAtom).cameras ?? []).map((entry) => entry.cameraId)
	const openingCamera = (store: ReturnType<typeof createStore>) =>
		(store.get(cameraAtom).cameras ?? []).find((entry) => entry.initial)
			?.cameraId
	const handleFor = (name: string) =>
		screen.getByRole('button', { name: `Reorder ${name}` })
	const announcement = () =>
		screen
			.getAllByRole('status')
			.map((region) => region.textContent)
			.filter(Boolean)
			.join('')
	const rowNames = () =>
		screen
			.getAllByRole('button')
			.filter((element) =>
				element.getAttribute('data-drill-down-trigger')?.startsWith('camera:')
			)
			.map((element) => element.getAttribute('data-drill-down-trigger'))

	it('lists the opening camera first and a hotspot’s camera last, without a handle', () => {
		renderPanel(sceneWithCameras())

		expect(rowNames()).toEqual([
			'camera:front',
			'camera:side',
			'camera:top',
			'camera:knob'
		])
		expect(
			screen.getByRole('button', { name: /^Front/ }).textContent
		).toContain('Opening view')
		expect(
			screen.queryByRole('button', { name: 'Reorder Knob Camera' })
		).toBeNull()
	})

	it('saves a camera moved to the top as the opening view, and says so', () => {
		const store = sceneWithCameras()
		renderPanel(store)

		act(() => {
			fireEvent.keyDown(handleFor('Top'), { key: 'Home' })
		})

		expect(storedOrder(store)).toEqual(['top', 'front', 'side', 'knob'])
		expect(openingCamera(store)).toBe('top')
		expect(rowNames()[0]).toBe('camera:top')
		expect(announcement()).toBe(
			'Top moved to position 1 of 3. The scene now opens on it.'
		)
	})

	it('saves a move down the order, and keeps focus on the handle', () => {
		const store = sceneWithCameras()
		renderPanel(store)
		handleFor('Front').focus()

		act(() => {
			fireEvent.keyDown(handleFor('Front'), { key: 'ArrowDown' })
		})

		expect(storedOrder(store)).toEqual(['side', 'front', 'top', 'knob'])
		expect(openingCamera(store)).toBe('side')
		expect(announcement()).toBe('Front moved to position 2 of 3.')
		expect(document.activeElement).toBe(handleFor('Front'))
	})

	it('says a camera is already first rather than doing nothing silently', () => {
		const store = sceneWithCameras()
		renderPanel(store)

		act(() => {
			fireEvent.keyDown(handleFor('Front'), { key: 'ArrowUp' })
		})

		expect(storedOrder(store)).toEqual(['knob', 'front', 'side', 'top'])
		expect(announcement()).toBe('Front is already first.')
	})

	it('moves the camera being edited to the top from its own view', async () => {
		const store = sceneWithCameras()
		renderPanel(store)

		fireEvent.click(screen.getByRole('button', { name: /^Side/ }))
		await screen.findByRole('heading', { name: 'Side' })
		const moveToTop = screen.getByRole('button', { name: 'Move to top' })
		moveToTop.focus()
		fireEvent.click(moveToTop)

		expect(storedOrder(store)).toEqual(['side', 'front', 'top', 'knob'])
		expect(openingCamera(store)).toBe('side')
		// aria-disabled rather than disabled: browsers drop focus from a button
		// that turns disabled, and this one does so in its own click. jsdom keeps
		// focus either way, so the property is what this asserts.
		const openingView = screen.getByRole('button', { name: 'Opening view' })
		expect(openingView.getAttribute('aria-disabled')).toBe('true')
		expect(openingView).toHaveProperty('disabled', false)
		expect(document.activeElement).toBe(openingView)
		expect(announcement()).toBe(
			'Side moved to the top. The scene now opens on it.'
		)
	})

	/**
	 * The list splits cameras by the published switcher's own rule. An
	 * untagged camera is a close-up only while a hotspot links it: then it has
	 * no handle; once nothing does, the switcher steps through it, so it is
	 * ordered like any view. (An untagged camera with a minted pair id is
	 * dropped from the embed once nothing links it, so it stays in the tail.)
	 */
	it('orders an untagged camera only while no hotspot links it', () => {
		const pairId = 'closeup'
		const store = createStore()
		store.set(cameraAtom, {
			cameras: [
				{ cameraId: 'front', name: 'Front' },
				{ cameraId: pairId, name: 'Knob Camera' },
				{ cameraId: 'side', name: 'Side' }
			]
		})
		const knob = {
			id: '00000000-0000-4000-8000-000000000001',
			name: 'Knob',
			worldPosition: [0, 0, 0] as [number, number, number],
			visible: true,
			internalOnly: false,
			stylePreset: 'dot' as const,
			linkedCameraId: pairId
		}
		store.set(hotspotsAtom, [knob])
		renderPanel(store)

		expect(rowNames()).toEqual([
			'camera:front',
			'camera:side',
			`camera:${pairId}`
		])
		expect(
			screen.queryByRole('button', { name: 'Reorder Knob Camera' })
		).toBeNull()

		act(() => {
			store.set(hotspotsAtom, [{ ...knob, linkedCameraId: undefined }])
		})

		expect(rowNames()).toEqual([
			'camera:front',
			`camera:${pairId}`,
			'camera:side'
		])
		expect(handleFor('Knob Camera')).toBeTruthy()
	})

	it('offers no move to the top for a hotspot’s camera', async () => {
		renderPanel(sceneWithCameras())

		fireEvent.click(screen.getByRole('button', { name: /^Knob Camera/ }))
		await screen.findByRole('heading', { name: 'Knob Camera' })

		expect(screen.getByRole('button', { name: 'Move to top' })).toHaveProperty(
			'disabled',
			true
		)
	})
})
