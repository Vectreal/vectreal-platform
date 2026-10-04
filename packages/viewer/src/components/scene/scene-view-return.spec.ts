import { describe, expect, it } from 'vitest'

import {
	leftOpenHotspotView,
	nextReturnCameraId,
	resolveActiveHotspot,
	resolveReturnCameraId
} from './scene-view-return'

/** What the surface draws. */
const markers = [
	{ name: 'Handle', linkedCameraId: 'hotspot-a' },
	{ name: 'Lid', linkedCameraId: 'hotspot-b' },
	{ name: 'Label', linkedCameraId: null },
	// Linked, from the publisher's picker, to the scene's own opening view.
	{ name: 'Overview', linkedCameraId: 'front' }
]

/** Every hotspot the scene stores: the drawn ones plus a hidden one. */
const links = [...markers, { name: 'Hidden', linkedCameraId: 'legacy-hidden' }]

const camera = (
	cameraId: string,
	extra: { initial?: boolean; kind?: 'scene' | 'hotspot' } = {}
) => ({ cameraId, ...extra })

const cameras = [
	camera('front', { kind: 'scene', initial: true }),
	camera('side', { kind: 'scene' }),
	camera('hotspot-a', { kind: 'hotspot' }),
	// Saved before paired cameras were tagged.
	camera('hotspot-b'),
	// A hidden hotspot's close-up, untagged as well.
	camera('legacy-hidden'),
	// A hidden hotspot's close-up, tagged.
	camera('hotspot-c', { kind: 'hotspot' })
]

describe('resolveActiveHotspot', () => {
	const active = (cameraId: null | string) =>
		resolveActiveHotspot(cameraId, cameras, links, markers)?.name ?? null

	it('names the marker whose close-up the view is on, tagged or not', () => {
		expect(active('hotspot-a')).toBe('Handle')
		expect(active('hotspot-b')).toBe('Lid')
	})

	it('is null on a scene camera, even one a marker links', () => {
		expect(active('side')).toBeNull()
		// The visitor is standing in the scene's own view.
		expect(active('front')).toBeNull()
	})

	it('is null before any camera is known, and for an unknown one', () => {
		expect(active(null)).toBeNull()
		expect(active('gone')).toBeNull()
	})

	it('is null on a close-up no drawn marker owns', () => {
		expect(active('hotspot-c')).toBeNull()
	})
})

describe('nextReturnCameraId', () => {
	const next = (recorded: null | string, cameraId: null | string) =>
		nextReturnCameraId(recorded, cameraId, cameras, links)

	it('records a scene camera the view lands on', () => {
		expect(next(null, 'side')).toBe('side')
		expect(next('side', 'front')).toBe('front')
	})

	it('keeps the scene camera across a hop from one marker to the next', () => {
		expect(next(next('side', 'hotspot-a'), 'hotspot-b')).toBe('side')
	})

	it('never records the close-up of a hotspot it does not draw', () => {
		expect(next('side', 'hotspot-c')).toBe('side')
		expect(next('side', 'legacy-hidden')).toBe('side')
	})

	it('keeps what it had for an event naming no known camera', () => {
		expect(next('front', null)).toBe('front')
		expect(next('front', 'gone')).toBe('front')
	})
})

describe('resolveReturnCameraId', () => {
	const target = (
		recorded: null | string,
		list: ReturnType<typeof camera>[] | undefined = cameras
	) => resolveReturnCameraId(recorded, list, links)

	it('returns to the recorded scene camera', () => {
		expect(target('side')).toBe('side')
	})

	it('returns to a scene camera a marker links', () => {
		expect(target('front')).toBe('front')
	})

	it('falls back to the initial scene camera when nothing was recorded', () => {
		expect(target(null)).toBe('front')
	})

	it('falls back when the recorded camera is not a scene camera', () => {
		expect(target('deleted')).toBe('front')
		expect(target('legacy-hidden')).toBe('front')
	})

	it('never falls back onto a close-up, tagged or not', () => {
		// `hotspot-b` predates the tag and carries `initial`.
		const legacy = [camera('hotspot-b', { initial: true }), camera('top')]
		expect(target(null, legacy)).toBe('top')
	})

	it('is null when the scene has nowhere else to go', () => {
		expect(target(null, [camera('hotspot-a', { kind: 'hotspot' })])).toBeNull()
		expect(resolveReturnCameraId(null, undefined, links)).toBeNull()
	})
})

describe('leftOpenHotspotView', () => {
	const handle = markers[0]

	it("closes the card once the view leaves its marker's camera", () => {
		expect(leftOpenHotspotView(handle, 'hotspot-a', 'front')).toBe(true)
	})

	it('keeps a card that just opened, before the camera has arrived', () => {
		// The click opens the card in the same render that sends the camera off;
		// `camera_changed` comes later.
		expect(leftOpenHotspotView(handle, 'front', 'front')).toBe(false)
	})

	it('keeps it while the view arrives at, or stays on, that camera', () => {
		expect(leftOpenHotspotView(handle, 'front', 'hotspot-a')).toBe(false)
		expect(leftOpenHotspotView(handle, 'hotspot-a', 'hotspot-a')).toBe(false)
	})

	it('leaves the card of a marker with no camera alone', () => {
		expect(leftOpenHotspotView(markers[2], 'hotspot-a', 'front')).toBe(false)
		expect(leftOpenHotspotView(null, 'hotspot-a', 'front')).toBe(false)
	})
})
