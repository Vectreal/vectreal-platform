import { isSceneCamera } from '@vctrl/core'

import {
	applyDefaultCameraFlag,
	buildDefaultCameraSignature,
	isLastSceneCamera,
	isPairedHotspotCamera,
	withSceneCameraKinds,
	resolveDefaultSceneCameraId
} from './scene-camera'
import { defaultCameraOptions } from '../../../constants/viewer-defaults'

import type { CameraLike } from './scene-camera'

describe('resolveDefaultSceneCameraId', () => {
	it('picks the first scene camera, skipping hotspots ahead of it', () => {
		expect(
			resolveDefaultSceneCameraId([
				{ cameraId: 'spot', kind: 'hotspot' },
				{ cameraId: 'main', kind: 'scene' },
				{ cameraId: 'other', kind: 'scene' }
			])
		).toBe('main')
	})

	// Better to open on something than to have no opening camera at all.
	it('falls back to the first entry when none is a scene camera', () => {
		expect(
			resolveDefaultSceneCameraId([{ cameraId: 'spot', kind: 'hotspot' }])
		).toBe('spot')
	})

	it('returns undefined when there are no cameras', () => {
		expect(resolveDefaultSceneCameraId([])).toBeUndefined()
		expect(resolveDefaultSceneCameraId(null)).toBeUndefined()
		expect(resolveDefaultSceneCameraId(undefined)).toBeUndefined()
	})
})

describe('isLastSceneCamera', () => {
	// The camera list is mostly hotspot cameras in a composed scene, so counting
	// entries instead of scene cameras reads as "plenty left" while the scene is
	// one delete away from opening on a hotspot.
	it('holds the last scene camera even with hotspot cameras alongside it', () => {
		expect(
			isLastSceneCamera(
				[
					{ cameraId: 'main', kind: 'scene' },
					{ cameraId: 'spot-a', kind: 'hotspot' },
					{ cameraId: 'spot-b', kind: 'hotspot' }
				],
				'main'
			)
		).toBe(true)
	})

	it('releases it once a second scene camera exists', () => {
		expect(
			isLastSceneCamera(
				[
					{ cameraId: 'main', kind: 'scene' },
					{ cameraId: 'other', kind: 'scene' }
				],
				'main'
			)
		).toBe(false)
	})

	it('never holds a hotspot camera', () => {
		expect(
			isLastSceneCamera(
				[
					{ cameraId: 'main', kind: 'scene' },
					{ cameraId: 'spot', kind: 'hotspot' }
				],
				'spot'
			)
		).toBe(false)
	})

	it('holds nothing for a camera that is not there', () => {
		expect(
			isLastSceneCamera([{ cameraId: 'main', kind: 'scene' }], 'gone')
		).toBe(false)
	})
})

describe('applyDefaultCameraFlag', () => {
	it('flags the camera the scene opens on and no other', () => {
		const result = applyDefaultCameraFlag([
			{ cameraId: 'spot', kind: 'hotspot' },
			{ cameraId: 'main', kind: 'scene' },
			{ cameraId: 'other', kind: 'scene' }
		])
		expect(result.map((c) => [c.cameraId, c.initial])).toEqual([
			['spot', false],
			['main', true],
			['other', false]
		])
	})

	// Pinning a camera as default reorders the array, which leaves the flag on
	// the camera that used to be first. Two cameras claiming the opening view
	// makes the frame depend on whoever reads the array.
	it('clears a flag left behind on a camera that is no longer the default', () => {
		const result = applyDefaultCameraFlag([
			{ cameraId: 'main', kind: 'scene' },
			{ cameraId: 'stale', kind: 'scene', initial: true }
		])
		expect(result.map((c) => c.initial)).toEqual([true, false])
	})

	it('flags the first entry when none of them is a scene camera', () => {
		const result = applyDefaultCameraFlag([
			{ cameraId: 'spot-a', kind: 'hotspot' },
			{ cameraId: 'spot-b', kind: 'hotspot' }
		])
		expect(result.map((c) => c.initial)).toEqual([true, false])
	})

	it('does not mutate the input', () => {
		const cameras = [
			{ cameraId: 'main', kind: 'scene' },
			{ cameraId: 'stale', kind: 'scene', initial: true }
		]
		applyDefaultCameraFlag(cameras)
		expect(cameras.map((c) => c.initial)).toEqual([undefined, true])
	})
})

describe('buildDefaultCameraSignature', () => {
	const main = {
		cameraId: 'main',
		kind: 'scene',
		position: [0, 1, 5],
		rotation: [0, 0, 0],
		target: [0, 0, 0],
		fov: 50
	}

	it('is stable when nothing about the opening view changed', () => {
		expect(buildDefaultCameraSignature([main])).toBe(
			buildDefaultCameraSignature([{ ...main }])
		)
	})

	// The old check compared only the camera id, so nudging the default camera
	// left the saved thumbnail showing the previous framing.
	it('changes when the default camera moves', () => {
		expect(buildDefaultCameraSignature([main])).not.toBe(
			buildDefaultCameraSignature([{ ...main, position: [3, 1, 5] }])
		)
	})

	it('changes when the field of view changes', () => {
		expect(buildDefaultCameraSignature([main])).not.toBe(
			buildDefaultCameraSignature([{ ...main, fov: 35 }])
		)
	})

	it('changes when a different camera becomes the default', () => {
		expect(buildDefaultCameraSignature([main])).not.toBe(
			buildDefaultCameraSignature([{ ...main, cameraId: 'other' }])
		)
	})

	// Only the opening camera matters; the rest cannot affect the load frame.
	it('ignores edits to non-default cameras', () => {
		expect(
			buildDefaultCameraSignature([main, { cameraId: 'b', kind: 'scene' }])
		).toBe(
			buildDefaultCameraSignature([
				main,
				{ cameraId: 'b', kind: 'scene', position: [9, 9, 9] }
			])
		)
	})

	it('treats `lookAt` as the target when no explicit target is set', () => {
		expect(
			buildDefaultCameraSignature([{ cameraId: 'main', lookAt: [1, 2, 3] }])
		).toBe(
			buildDefaultCameraSignature([{ cameraId: 'main', target: [1, 2, 3] }])
		)
	})

	it('returns null when there is no camera to describe', () => {
		expect(buildDefaultCameraSignature([])).toBeNull()
		expect(buildDefaultCameraSignature(undefined)).toBeNull()
	})
})

describe('isPairedHotspotCamera', () => {
	it('takes the tag whenever it is there', () => {
		expect(
			isPairedHotspotCamera({ cameraId: 'anything', kind: 'hotspot' })
		).toBe(true)
		expect(isPairedHotspotCamera({ cameraId: 'main', kind: 'scene' })).toBe(
			false
		)
	})

	// Every scene saved before paired cameras carried `kind` has an untagged
	// one, and the minted id is the only thing left that identifies it.
	it('recognizes an untagged camera by the id the publisher minted', () => {
		expect(
			isPairedHotspotCamera({ cameraId: 'hotspot-camera-1755123456789-a1b2' })
		).toBe(true)
		expect(
			isPairedHotspotCamera({ cameraId: 'hotspot-camera-1755123456789-a' })
		).toBe(true)
	})

	// Ordinary camera ids are slugified from the camera's name, so the bare
	// prefix would claim cameras someone simply named "Hotspot Camera 1".
	it('does not claim ids that only slugify to the same prefix', () => {
		for (const cameraId of [
			'hotspot-camera-1',
			'hotspot-camera-2',
			'hotspot-camera-view',
			'hotspot-camera',
			'hotspot-camera-front-detail'
		]) {
			expect(isPairedHotspotCamera({ cameraId }), cameraId).toBe(false)
		}
	})

	// An explicit tag always wins, so a scene camera that happens to carry a
	// minted-looking id is still a scene camera.
	it('lets an explicit scene tag override the id', () => {
		expect(
			isPairedHotspotCamera({
				cameraId: 'hotspot-camera-1755123456789-a1b2',
				kind: 'scene'
			})
		).toBe(false)
	})

	it('claims nothing when there is no id and no tag', () => {
		expect(isPairedHotspotCamera({})).toBe(false)
	})
})

describe('withSceneCameraKinds', () => {
	const minted = 'hotspot-camera-1755000000000-a1b2c3'
	const kinds = (cameras: CameraLike[]) =>
		withSceneCameraKinds({ cameras }).cameras?.map((entry) => entry.kind)

	it('tags an untagged camera that is not a minted pair as a scene camera', () => {
		expect(
			kinds([
				{ cameraId: 'default' },
				// Composed by hand and named like a pair; a slug, not a minted id.
				{ cameraId: 'hotspot-camera-1' }
			])
		).toEqual(['scene', 'scene'])
	})

	it('leaves a minted pair untagged, so no rule keyed on the tag adopts it', () => {
		expect(kinds([{ cameraId: minted }])).toEqual([undefined])
	})

	it('keeps a kind that is already there', () => {
		expect(
			kinds([
				{ cameraId: 'default', kind: 'hotspot' },
				{ cameraId: minted, kind: 'scene' }
			])
		).toEqual(['hotspot', 'scene'])
	})

	it('changes nothing any rule here reads', () => {
		const before: CameraLike[] = [
			{ cameraId: minted },
			{ cameraId: 'default' },
			{ cameraId: 'side' }
		]
		const after = withSceneCameraKinds({ cameras: before }).cameras ?? []
		expect(after.map(isSceneCamera)).toEqual(before.map(isSceneCamera))
		expect(after.map(isPairedHotspotCamera)).toEqual(
			before.map(isPairedHotspotCamera)
		)
		expect(resolveDefaultSceneCameraId(after)).toBe(
			resolveDefaultSceneCameraId(before)
		)
	})

	it('has nothing to tag in the camera a new scene starts with', () => {
		// That camera reaches the viewer before any save or read: the Publisher
		// edits it in place, and a hotspot can link it from the first minute.
		const cameras = defaultCameraOptions.cameras ?? []
		expect(cameras.length).toBeGreaterThan(0)
		expect(cameras.every((entry) => entry.kind === 'scene')).toBe(true)
	})

	it('returns the same settings when nothing needed tagging', () => {
		const camera = { cameras: [{ cameraId: 'default', kind: 'scene' }] }
		expect(withSceneCameraKinds(camera)).toBe(camera)
	})
})
