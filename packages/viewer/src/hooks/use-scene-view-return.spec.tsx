// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSceneViewReturn } from './use-scene-view-return'

import type { HotspotMarker } from '../components/scene/resolve-hotspot-markers'
import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

const cameras = [
	{ cameraId: 'front', name: 'Front', initial: true },
	{ cameraId: 'side', name: 'Side' },
	{ cameraId: 'hotspot-a', name: 'Handle camera', kind: 'hotspot' },
	{ cameraId: 'hotspot-b', name: 'Lid camera', kind: 'hotspot' },
	// A hidden hotspot's camera: no drawn marker links it.
	{ cameraId: 'hotspot-hidden', name: 'Hidden camera', kind: 'hotspot' }
] as CameraConfig[]

const markers = [
	{ id: 'a', name: 'Handle', linkedCameraId: 'hotspot-a' },
	{ id: 'b', name: 'Lid', linkedCameraId: 'hotspot-b' }
] as HotspotMarker[]

function setup(initialCameraId: null | string = null) {
	const activateCamera = vi.fn()
	const hook = renderHook(
		({ activeCameraId }: { activeCameraId: null | string }) =>
			useSceneViewReturn({
				cameras,
				hotspots: markers as unknown as HotspotDefinition[],
				markers,
				activeCameraId,
				activateCamera
			}),
		{ initialProps: { activeCameraId: initialCameraId } }
	)

	/** What the viewer's interaction funnel does on a camera event. */
	const land = (cameraId: string) => {
		act(() => hook.result.current.noteCamera(cameraId))
		hook.rerender({ activeCameraId: cameraId })
	}

	return { hook, land, activateCamera }
}

describe('useSceneViewReturn', () => {
	it('offers no way back on a scene camera', () => {
		const { hook, land } = setup()
		land('side')

		expect(hook.result.current.hotspot).toBeNull()
		expect(hook.result.current.returnToSceneView()).toBe(false)
	})

	it('does nothing before the viewer has reported a camera', () => {
		const { hook, activateCamera } = setup()

		expect(hook.result.current.returnToSceneView()).toBe(false)
		expect(activateCamera).not.toHaveBeenCalled()
	})

	it('returns to the scene camera the visitor left, not the default', () => {
		const { hook, land, activateCamera } = setup()
		land('side')
		land('hotspot-a')

		expect(hook.result.current.hotspot?.name).toBe('Handle')
		expect(hook.result.current.returnToSceneView()).toBe(true)
		expect(activateCamera).toHaveBeenCalledWith('side')
	})

	it('returns past every marker hopped through', () => {
		const { hook, land, activateCamera } = setup()
		land('side')
		land('hotspot-a')
		land('hotspot-b')

		expect(hook.result.current.hotspot?.name).toBe('Lid')
		hook.result.current.returnToSceneView()
		expect(activateCamera).toHaveBeenCalledWith('side')
	})

	it("returns past a hidden hotspot's camera the view passed through", () => {
		const { hook, land, activateCamera } = setup()
		land('side')
		land('hotspot-hidden')
		land('hotspot-a')

		hook.result.current.returnToSceneView()
		expect(activateCamera).toHaveBeenCalledWith('side')
	})

	it('falls back to the default camera for a view that opened at a hotspot', () => {
		const { hook, land, activateCamera } = setup()
		land('hotspot-b')

		hook.result.current.returnToSceneView()
		expect(activateCamera).toHaveBeenCalledWith('front')
	})
})
