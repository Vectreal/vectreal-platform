import { describe, expect, it } from 'vitest'

import { reanchorHotspotsForScale } from './scene-hotspot-reanchor'

import type { CameraHotspotState } from './scene-hotspot-camera-links'
import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

const hotspot = (
	id: string,
	worldPosition: [number, number, number],
	overrides: Partial<HotspotDefinition> = {}
): HotspotDefinition => ({
	id,
	name: id,
	worldPosition,
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

const camera = (
	cameraId: string,
	overrides: Partial<CameraConfig> = {}
): CameraConfig => ({ cameraId, name: cameraId, ...overrides })

/** A hotspot and the camera it owns, aimed at it, as `placeHotspot` leaves them. */
const paired = (): CameraHotspotState => ({
	camera: {
		cameras: [
			camera('cam-a', { kind: 'hotspot', target: [2, 4, 6] }),
			camera('default', { kind: 'scene', position: [0, 1, 3] })
		]
	},
	hotspots: [hotspot('h1', [2, 4, 6], { linkedCameraId: 'cam-a' })]
})

const targetOf = (state: CameraHotspotState, cameraId: string) =>
	state.camera.cameras?.find((entry) => entry.cameraId === cameraId)?.target

describe('reanchorHotspotsForScale', () => {
	it('scales a hotspot by the ratio between the two normalization scales', () => {
		const next = reanchorHotspotsForScale(paired(), 1, 2)

		expect(next.hotspots[0].worldPosition).toEqual([4, 8, 12])
	})

	it('turns the hotspot-owned camera to keep looking at the marker', () => {
		const next = reanchorHotspotsForScale(paired(), 1, 2)

		expect(targetOf(next, 'cam-a')).toEqual([4, 8, 12])
	})

	it('scales back down when normalization is reverted', () => {
		const scaled = reanchorHotspotsForScale(paired(), 1, 2)
		const reverted = reanchorHotspotsForScale(scaled, 2, 1)

		expect(reverted.hotspots[0].worldPosition).toEqual([2, 4, 6])
	})

	it('re-aims a camera left stale by an earlier scale it did not follow', () => {
		// A symmetric round trip returns a stale target to its own start value,
		// so this starts the camera aimed somewhere the marker never was. Without
		// the re-aim the target keeps that value instead of tracking the marker.
		const state = paired()
		state.camera.cameras = [
			camera('cam-a', { kind: 'hotspot', target: [9, 9, 9] })
		]

		const next = reanchorHotspotsForScale(state, 1, 2)

		expect(targetOf(next, 'cam-a')).toEqual([4, 8, 12])
	})

	it('moves every hotspot, not only the first', () => {
		const state: CameraHotspotState = {
			camera: { cameras: [] },
			hotspots: [hotspot('h1', [1, 0, 0]), hotspot('h2', [0, 0, 3])]
		}

		const next = reanchorHotspotsForScale(state, 2, 1)

		expect(next.hotspots.map((h) => h.worldPosition)).toEqual([
			[0.5, 0, 0],
			[0, 0, 1.5]
		])
	})

	it('leaves a camera the author framed by hand alone', () => {
		const next = reanchorHotspotsForScale(paired(), 1, 2)

		expect(
			next.camera.cameras?.find((entry) => entry.cameraId === 'default')
		).toEqual(camera('default', { kind: 'scene', position: [0, 1, 3] }))
	})

	it('returns the state it was given when the scale did not change', () => {
		const state = paired()

		expect(reanchorHotspotsForScale(state, 3, 3)).toBe(state)
	})

	it.each([
		['a zero previous scale', 0, 2],
		['a negative previous scale', -1, 2],
		['a zero next scale', 1, 0],
		['a negative next scale', 1, -1],
		['a NaN previous scale', Number.NaN, 2],
		['a NaN next scale', 1, Number.NaN],
		['an infinite previous scale', Number.POSITIVE_INFINITY, 2],
		['an infinite next scale', 1, Number.POSITIVE_INFINITY]
	])(
		'refuses %s rather than writing a bad coordinate into every marker',
		(_label, previous, next) => {
			// A NaN slipping through would persist: `NaN <= 0` is false, so the
			// finiteness clauses are the only thing standing in front of the store.
			const state = paired()

			expect(reanchorHotspotsForScale(state, previous, next)).toBe(state)
		}
	)

	it('composes across an asymmetric pair of changes', () => {
		// A symmetric round trip cancels, so it cannot tell a correct ratio from an
		// inverted one on its own.
		const once = reanchorHotspotsForScale(paired(), 1, 2)
		const twice = reanchorHotspotsForScale(once, 2, 0.5)

		expect(twice.hotspots[0].worldPosition).toEqual([1, 2, 3])
		expect(targetOf(twice, 'cam-a')).toEqual([1, 2, 3])
	})
})
