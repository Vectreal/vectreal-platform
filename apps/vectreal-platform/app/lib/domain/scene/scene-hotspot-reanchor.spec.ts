import { describe, expect, it } from 'vitest'

import { reanchorSceneForScale } from './scene-hotspot-reanchor'

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

describe('reanchorSceneForScale', () => {
	it('scales a hotspot by the ratio between the two normalization scales', () => {
		const next = reanchorSceneForScale(paired(), 1, 2)

		expect(next.hotspots[0].worldPosition).toEqual([4, 8, 12])
	})

	it('turns the hotspot-owned camera to keep looking at the marker', () => {
		const next = reanchorSceneForScale(paired(), 1, 2)

		expect(targetOf(next, 'cam-a')).toEqual([4, 8, 12])
	})

	it('scales back down when normalization is reverted', () => {
		const scaled = reanchorSceneForScale(paired(), 1, 2)
		const reverted = reanchorSceneForScale(scaled, 2, 1)

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

		const next = reanchorSceneForScale(state, 1, 2)

		expect(targetOf(next, 'cam-a')).toEqual([4, 8, 12])
	})

	it('moves every hotspot, not only the first', () => {
		const state: CameraHotspotState = {
			camera: { cameras: [] },
			hotspots: [hotspot('h1', [1, 0, 0]), hotspot('h2', [0, 0, 3])]
		}

		const next = reanchorSceneForScale(state, 2, 1)

		expect(next.hotspots.map((h) => h.worldPosition)).toEqual([
			[0.5, 0, 0],
			[0, 0, 1.5]
		])
	})

	it('moves a hotspot camera’s position with the model', () => {
		// `addHotspot` stands the camera where the editor's view was; left behind,
		// a shrink would leave it looking at the model from ten times too far.
		const state = paired()
		state.camera.cameras = [
			camera('cam-a', {
				kind: 'hotspot',
				position: [0, 2, 10],
				target: [2, 4, 6]
			})
		]

		const next = reanchorSceneForScale(state, 1, 0.5)

		expect(
			next.camera.cameras?.find((entry) => entry.cameraId === 'cam-a')?.position
		).toEqual([0, 1, 5])
	})

	it('keeps a camera two hotspots share looking at the model', () => {
		// Shared, it has no owner for `placeHotspot` to re-aim, so the target has
		// to travel with the position or the view turns away.
		const state: CameraHotspotState = {
			camera: {
				cameras: [
					camera('cam-a', {
						kind: 'hotspot',
						position: [0, 2, 10],
						target: [2, 4, 6]
					})
				]
			},
			hotspots: [
				hotspot('h1', [2, 4, 6], { linkedCameraId: 'cam-a' }),
				hotspot('h2', [0, 0, 0], { linkedCameraId: 'cam-a' })
			]
		}

		const next = reanchorSceneForScale(state, 1, 0.5)
		const cam = next.camera.cameras?.find((entry) => entry.cameraId === 'cam-a')

		expect(cam?.position).toEqual([0, 1, 5])
		expect(cam?.target).toEqual([1, 2, 3])
	})

	it('moves a camera the author framed by hand with the model', () => {
		// Left behind, a shrink would frame the model from ten times too far,
		// and the camera would keep looking where the larger model's centre was.
		const state = paired()
		state.camera.cameras = [
			camera('framed', {
				kind: 'scene',
				position: [0, 2, 10],
				target: [0, 1, 0]
			})
		]

		const next = reanchorSceneForScale(state, 1, 0.5)

		expect(next.camera.cameras?.[0]).toEqual(
			camera('framed', {
				kind: 'scene',
				position: [0, 1, 5],
				target: [0, 0.5, 0]
			})
		)
	})

	it('moves a camera stored before cameras carried a kind', () => {
		// `kind` is optional and absent means a scene camera, so older scenes
		// hold framed cameras with no kind at all.
		const state = paired()
		state.camera.cameras = [camera('legacy', { position: [4, 0, 0] })]

		const next = reanchorSceneForScale(state, 1, 2)

		expect(next.camera.cameras?.[0].position).toEqual([8, 0, 0])
	})

	it('leaves a camera with no stored pose as it is', () => {
		// It opens on the viewer's own framing, which already follows the model.
		const state = paired()
		state.camera.cameras = [camera('default', { kind: 'scene' })]

		const next = reanchorSceneForScale(state, 1, 2)

		expect(next.camera.cameras?.[0]).toEqual(
			camera('default', { kind: 'scene' })
		)
	})

	it('returns the state it was given when the scale did not change', () => {
		const state = paired()

		expect(reanchorSceneForScale(state, 3, 3)).toBe(state)
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

			expect(reanchorSceneForScale(state, previous, next)).toBe(state)
		}
	)

	it('composes across an asymmetric pair of changes', () => {
		// A symmetric round trip cancels, so it cannot tell a correct ratio from an
		// inverted one on its own.
		const once = reanchorSceneForScale(paired(), 1, 2)
		const twice = reanchorSceneForScale(once, 2, 0.5)

		expect(twice.hotspots[0].worldPosition).toEqual([1, 2, 3])
		expect(targetOf(twice, 'cam-a')).toEqual([1, 2, 3])
	})
})
