import {
	buildDefaultCameraSignature,
	isSceneCamera,
	resolveDefaultSceneCameraId
} from '../app/lib/domain/scene/scene-camera'

describe('isSceneCamera', () => {
	it('treats an explicit scene camera and a legacy entry without a kind as scene cameras', () => {
		expect(isSceneCamera({ kind: 'scene' })).toBe(true)
		expect(isSceneCamera({})).toBe(true)
	})

	it('excludes navigational entries', () => {
		expect(isSceneCamera({ kind: 'hotspot' })).toBe(false)
	})
})

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
			buildDefaultCameraSignature([
				{ cameraId: 'main', lookAt: [1, 2, 3] }
			])
		).toBe(
			buildDefaultCameraSignature([{ cameraId: 'main', target: [1, 2, 3] }])
		)
	})

	it('returns null when there is no camera to describe', () => {
		expect(buildDefaultCameraSignature([])).toBeNull()
		expect(buildDefaultCameraSignature(undefined)).toBeNull()
	})
})
