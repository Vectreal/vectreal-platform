import {
	addHotspot,
	relinkHotspot,
	removeCamera,
	removeHotspot,
	placeHotspot,
	renameHotspot,
	repointHotspotLinks
} from './scene-hotspot-camera-links'

import type { CameraHotspotState } from './scene-hotspot-camera-links'
import type { CameraConfig, HotspotDefinition } from '@vctrl/core'

const hotspot = (
	id: string,
	overrides: Partial<HotspotDefinition> = {}
): HotspotDefinition => ({
	id,
	name: id,
	worldPosition: [0, 0, 0],
	visible: true,
	internalOnly: false,
	stylePreset: 'dot',
	...overrides
})

const camera = (
	cameraId: string,
	overrides: Partial<CameraConfig> = {}
): CameraConfig => ({ cameraId, name: cameraId, ...overrides })

const sceneCamera = camera('default', { kind: 'scene', position: [0, 1, 3] })
// Untagged and composed by hand: nothing about it says "hotspot pair".
const legacyCamera = camera('legacy')
// Untagged but minted by `addHotspot`, which is every scene saved before
// paired cameras started carrying `kind`.
const legacyPairedCamera = camera('hotspot-camera-1755123456789-a1b2')
const cameraA = camera('cam-a', { kind: 'hotspot' })
const cameraB = camera('cam-b', { kind: 'hotspot' })

const cameraIds = (state: CameraHotspotState | null) =>
	state?.camera.cameras?.map((c) => c.cameraId)

describe('addHotspot', () => {
	const cameras = [sceneCamera]
	const ids = { hotspotId: 'new-hotspot', cameraId: 'new-camera' }

	it('appends a hotspot already linked to the camera minted with it', () => {
		const result = addHotspot({ camera: { cameras }, hotspots: [] }, ids)
		expect(result.hotspots).toEqual([
			{
				id: 'new-hotspot',
				name: 'New Hotspot',
				worldPosition: [0, 0, 0],
				visible: true,
				internalOnly: false,
				occlusionEnabled: true,
				stylePreset: 'dot',
				linkedCameraId: 'new-camera'
			}
		])
	})

	// Without the kind the camera reads as a scene camera, and every ownership
	// test here stops recognizing it as the hotspot's to rename or retire.
	it('mints the paired camera as a hotspot camera', () => {
		const result = addHotspot({ camera: { cameras }, hotspots: [] }, ids)
		expect(result.camera.cameras?.[1]).toEqual({
			cameraId: 'new-camera',
			kind: 'hotspot',
			name: 'New Hotspot Camera',
			fov: 60
		})
	})

	it('leaves the hotspots and cameras already in the scene alone', () => {
		const result = addHotspot(
			{ camera: { cameras }, hotspots: [hotspot('a')] },
			ids
		)
		expect(result.hotspots.map((h) => h.id)).toEqual(['a', 'new-hotspot'])
		expect(cameraIds(result)).toEqual(['default', 'new-camera'])
	})

	it('mints a camera removeHotspot then retires with the hotspot', () => {
		const added = addHotspot({ camera: { cameras }, hotspots: [] }, ids)
		const result = removeHotspot(added, 'new-hotspot')
		expect(result.hotspots).toEqual([])
		expect(cameraIds(result)).toEqual(['default'])
	})

	it('does not mutate the input', () => {
		const state = {
			camera: { cameras: [...cameras] },
			hotspots: [hotspot('a')]
		}
		addHotspot(state, ids)
		expect(cameraIds(state)).toEqual(['default'])
		expect(state.hotspots.map((h) => h.id)).toEqual(['a'])
	})
})

describe('removeHotspot', () => {
	const cameras = [sceneCamera, legacyCamera, cameraA, cameraB]

	it('removes only the named hotspot', () => {
		const result = removeHotspot(
			{ camera: { cameras }, hotspots: [hotspot('a'), hotspot('b')] },
			'a'
		)
		expect(result.hotspots.map((h) => h.id)).toEqual(['b'])
	})

	it('retires the camera minted with the hotspot', () => {
		const result = removeHotspot(
			{
				camera: { cameras },
				hotspots: [hotspot('a', { linkedCameraId: 'cam-a' })]
			},
			'a'
		)
		expect(cameraIds(result)).toEqual(['default', 'legacy', 'cam-b'])
	})

	it('keeps every camera when the hotspot had no linked camera', () => {
		const state = { camera: { cameras }, hotspots: [hotspot('a')] }
		expect(removeHotspot(state, 'a').camera).toBe(state.camera)
	})

	// The Linked Camera picker offers every camera in the scene, so a hotspot
	// can point at the frame the scene opens on. Deleting the hotspot must not
	// reach it.
	it('never retires a scene camera', () => {
		const state = {
			camera: { cameras },
			hotspots: [hotspot('a', { linkedCameraId: 'default' })]
		}
		expect(removeHotspot(state, 'a').camera).toBe(state.camera)
	})

	// A camera saved before `kind` existed reads as a scene camera, which is
	// what `isSceneCamera` decided and what the viewer still assumes.
	it('never retires a camera saved without a kind', () => {
		const state = {
			camera: { cameras },
			hotspots: [hotspot('a', { linkedCameraId: 'legacy' })]
		}
		expect(removeHotspot(state, 'a').camera).toBe(state.camera)
	})

	/*
	  Even when the id says the publisher minted it. `isPairedHotspotCamera`
	  would call this a pair, but retiring is destructive and `isSceneCamera`
	  still counts an untagged camera as one the scene can open on - so acting
	  on the id here would let deleting a hotspot silently take the scene's
	  opening frame. The looser rule is for the embed manifest, where guessing
	  wrong hides a viewpoint rather than destroying one.
	*/
	it('never retires an untagged camera, even one whose id looks minted', () => {
		const state = {
			camera: { cameras: [sceneCamera, legacyPairedCamera] },
			hotspots: [hotspot('a', { linkedCameraId: legacyPairedCamera.cameraId })]
		}
		expect(cameraIds(removeHotspot(state, 'a'))).toEqual([
			'default',
			legacyPairedCamera.cameraId
		])
	})

	// Otherwise the survivor is silently unlinked, which changes playback
	// without saying so.
	it('never retires a camera another hotspot still uses', () => {
		const state = {
			camera: { cameras },
			hotspots: [
				hotspot('a', { linkedCameraId: 'cam-a' }),
				hotspot('b', { linkedCameraId: 'cam-a' })
			]
		}
		const result = removeHotspot(state, 'a')
		expect(result.camera).toBe(state.camera)
		expect(result.hotspots[0].linkedCameraId).toBe('cam-a')
	})

	it('retires a camera once the deleted hotspot is the only one using it', () => {
		const result = removeHotspot(
			{
				camera: { cameras },
				hotspots: [
					hotspot('a', { linkedCameraId: 'cam-a' }),
					hotspot('b', { linkedCameraId: 'cam-b' })
				]
			},
			'a'
		)
		expect(cameraIds(result)).toEqual(['default', 'legacy', 'cam-b'])
	})

	it('keeps every camera when the link names one that is already gone', () => {
		const state = {
			camera: { cameras },
			hotspots: [hotspot('a', { linkedCameraId: 'cam-missing' })]
		}
		expect(removeHotspot(state, 'a').camera).toBe(state.camera)
	})

	it('changes nothing when the hotspot is not present', () => {
		const state = { camera: { cameras }, hotspots: [hotspot('a')] }
		const result = removeHotspot(state, 'gone')
		expect(result.camera).toBe(state.camera)
		expect(result.hotspots.map((h) => h.id)).toEqual(['a'])
	})

	// The server takes any distinct non-negative indices, gaps included, so
	// renumbering the survivors would rewrite an order nobody touched.
	it('leaves the surviving sequence indices alone, gap and all', () => {
		const result = removeHotspot(
			{
				camera: { cameras },
				hotspots: [
					hotspot('a', { sequenceIndex: 0 }),
					hotspot('b', { sequenceIndex: 1 }),
					hotspot('c', { sequenceIndex: 2 })
				]
			},
			'b'
		)
		expect(result.hotspots.map((h) => [h.id, h.sequenceIndex])).toEqual([
			['a', 0],
			['c', 2]
		])
	})

	it('does not mutate the input', () => {
		const state = {
			camera: { cameras: [...cameras] },
			hotspots: [hotspot('a', { linkedCameraId: 'cam-a' }), hotspot('b')]
		}
		removeHotspot(state, 'a')
		expect(cameraIds(state)).toEqual(['default', 'legacy', 'cam-a', 'cam-b'])
		expect(state.hotspots.map((h) => h.id)).toEqual(['a', 'b'])
	})
})

describe('relinkHotspot', () => {
	const emptyCamera = camera('empty', { kind: 'hotspot' })
	const cameras = [
		sceneCamera,
		emptyCamera,
		camera('framed', { kind: 'hotspot', position: [1, 2, 3] }),
		camera('aimed', { kind: 'hotspot', target: [0, 0, 0] })
	]

	it('points the hotspot at the camera it was given', () => {
		const result = relinkHotspot(
			{
				camera: { cameras },
				hotspots: [hotspot('a', { linkedCameraId: 'empty' })]
			},
			'a',
			'default'
		)
		expect(result.hotspots[0].linkedCameraId).toBe('default')
	})

	it('drops the empty camera the hotspot was moved off', () => {
		const result = relinkHotspot(
			{
				camera: { cameras },
				hotspots: [hotspot('a', { linkedCameraId: 'empty' })]
			},
			'a',
			'default'
		)
		expect(cameraIds(result)).toEqual(['default', 'framed', 'aimed'])
	})

	// It holds a frame someone composed, and a hotspot can be pointed back at
	// it later.
	it('keeps a camera that has been framed', () => {
		const state = {
			camera: { cameras },
			hotspots: [hotspot('a', { linkedCameraId: 'framed' })]
		}
		const result = relinkHotspot(state, 'a', undefined)
		expect(result.hotspots[0].linkedCameraId).toBeUndefined()
		expect(result.camera).toBe(state.camera)
	})

	it('keeps a camera that has been aimed', () => {
		const state = {
			camera: { cameras },
			hotspots: [hotspot('a', { linkedCameraId: 'aimed' })]
		}
		expect(relinkHotspot(state, 'a', 'default').camera).toBe(state.camera)
	})

	it('keeps a camera another hotspot moved onto', () => {
		const state = {
			camera: { cameras },
			hotspots: [
				hotspot('a', { linkedCameraId: 'empty' }),
				hotspot('b', { linkedCameraId: 'empty' })
			]
		}
		expect(relinkHotspot(state, 'a', 'default').camera).toBe(state.camera)
	})

	it('never drops a scene camera', () => {
		const state = {
			camera: { cameras },
			hotspots: [hotspot('a', { linkedCameraId: 'default' })]
		}
		expect(relinkHotspot(state, 'a', 'empty').camera).toBe(state.camera)
	})

	it('drops nothing when the hotspot had no camera', () => {
		const state = { camera: { cameras }, hotspots: [hotspot('a')] }
		expect(relinkHotspot(state, 'a', 'empty').camera).toBe(state.camera)
	})

	it('leaves the opening view on a scene camera after dropping one', () => {
		const result = relinkHotspot(
			{
				camera: { cameras: [emptyCamera, sceneCamera] },
				hotspots: [hotspot('a', { linkedCameraId: 'empty' })]
			},
			'a',
			'default'
		)
		expect(result.camera.cameras?.map((c) => [c.cameraId, c.initial])).toEqual([
			['default', true]
		])
	})

	it('does not mutate the input', () => {
		const state = {
			camera: { cameras: [...cameras] },
			hotspots: [hotspot('a', { linkedCameraId: 'empty' })]
		}
		relinkHotspot(state, 'a', 'default')
		expect(cameraIds(state)).toEqual(['default', 'empty', 'framed', 'aimed'])
		expect(state.hotspots[0].linkedCameraId).toBe('empty')
	})
})

describe('placeHotspot', () => {
	const cameras = [sceneCamera, legacyCamera, cameraA]
	const AT: [number, number, number] = [1, 2, 3]

	it('moves the hotspot', () => {
		const result = placeHotspot(
			{ camera: { cameras }, hotspots: [hotspot('a')] },
			'a',
			AT
		)

		expect(result.hotspots[0].worldPosition).toEqual(AT)
	})

	it('takes the camera the hotspot owns along with it', () => {
		const result = placeHotspot(
			{
				camera: { cameras },
				hotspots: [hotspot('a', { linkedCameraId: 'cam-a' })]
			},
			'a',
			AT
		)

		expect(
			result.camera.cameras?.find((c) => c.cameraId === 'cam-a')?.target
		).toEqual(AT)
	})

	it('leaves where the camera stands, and only where it looks', () => {
		// Moving a marker says where the point of interest is, not where the author
		// wants to stand to see it.
		const framed = camera('cam-a', {
			kind: 'hotspot',
			position: [5, 5, 5],
			target: [0, 0, 0]
		})
		const result = placeHotspot(
			{
				camera: { cameras: [framed] },
				hotspots: [hotspot('a', { linkedCameraId: 'cam-a' })]
			},
			'a',
			AT
		)

		expect(result.camera.cameras?.[0].position).toEqual([5, 5, 5])
		expect(result.camera.cameras?.[0].target).toEqual(AT)
	})

	it('never re-aims a camera the author composed', () => {
		// The Linked Camera picker offers every camera in the scene, so a hotspot
		// can point at the opening frame. Moving the marker must not turn it.
		const result = placeHotspot(
			{
				camera: { cameras },
				hotspots: [hotspot('a', { linkedCameraId: 'default' })]
			},
			'a',
			AT
		)

		expect(
			result.camera.cameras?.find((c) => c.cameraId === 'default')?.target
		).toBeUndefined()
	})

	it('never re-aims a camera another hotspot also points at', () => {
		const result = placeHotspot(
			{
				camera: { cameras },
				hotspots: [
					hotspot('a', { linkedCameraId: 'cam-a' }),
					hotspot('b', { linkedCameraId: 'cam-a' })
				]
			},
			'a',
			AT
		)

		expect(
			result.camera.cameras?.find((c) => c.cameraId === 'cam-a')?.target
		).toBeUndefined()
	})

	it('leaves every other hotspot and camera untouched', () => {
		const result = placeHotspot(
			{
				camera: { cameras },
				hotspots: [
					hotspot('a', { linkedCameraId: 'cam-a' }),
					hotspot('b', { worldPosition: [7, 7, 7] })
				]
			},
			'a',
			AT
		)

		expect(result.hotspots[1].worldPosition).toEqual([7, 7, 7])
		expect(cameraIds(result)).toEqual(['default', 'legacy', 'cam-a'])
	})

	it('moves a hotspot that owns no camera at all', () => {
		const result = placeHotspot(
			{ camera: { cameras }, hotspots: [hotspot('a')] },
			'a',
			AT
		)

		expect(result.hotspots[0].worldPosition).toEqual(AT)
		expect(result.camera).toBe(result.camera)
		expect(result.camera.cameras?.every((c) => c.target === undefined)).toBe(
			true
		)
	})
})

describe('renameHotspot', () => {
	const cameras = [sceneCamera, legacyCamera, cameraA]

	it('renames the hotspot', () => {
		const result = renameHotspot(
			{ camera: { cameras }, hotspots: [hotspot('a')] },
			'a',
			'Engine Bay'
		)
		expect(result.hotspots[0].name).toBe('Engine Bay')
	})

	it('follows the rename onto the camera the hotspot owns', () => {
		const result = renameHotspot(
			{
				camera: { cameras },
				hotspots: [hotspot('a', { linkedCameraId: 'cam-a' })]
			},
			'a',
			'Engine Bay'
		)
		expect(result.camera.cameras?.map((c) => c.name)).toEqual([
			'default',
			'legacy',
			'Engine Bay Camera'
		])
	})

	it('names the camera for an unnamed hotspot rather than leaving it blank', () => {
		const result = renameHotspot(
			{
				camera: { cameras },
				hotspots: [hotspot('a', { linkedCameraId: 'cam-a' })]
			},
			'a',
			''
		)
		expect(result.camera.cameras?.[2].name).toBe('Unnamed Hotspot Camera')
	})

	it('never renames a camera the hotspot only points at', () => {
		const state = {
			camera: { cameras },
			hotspots: [hotspot('a', { linkedCameraId: 'default' })]
		}
		expect(renameHotspot(state, 'a', 'Engine Bay').camera).toBe(state.camera)
	})

	it('never renames a camera another hotspot still uses', () => {
		const state = {
			camera: { cameras },
			hotspots: [
				hotspot('a', { linkedCameraId: 'cam-a' }),
				hotspot('b', { linkedCameraId: 'cam-a' })
			]
		}
		expect(renameHotspot(state, 'a', 'Engine Bay').camera).toBe(state.camera)
	})

	it('leaves the cameras alone when the hotspot owns none', () => {
		const state = { camera: { cameras }, hotspots: [hotspot('a')] }
		expect(renameHotspot(state, 'a', 'Engine Bay').camera).toBe(state.camera)
	})
})

describe('removeCamera', () => {
	const mainCamera = camera('main', { kind: 'scene' })
	const otherCamera = camera('other', { kind: 'scene' })

	// A link naming a camera that is gone is a hard 400 on save, which blocks
	// every later save of the scene and names neither side.
	it('takes the camera out and cuts every hotspot loose from it', () => {
		const result = removeCamera(
			{
				camera: { cameras: [mainCamera, cameraA] },
				hotspots: [
					hotspot('a', { linkedCameraId: 'cam-a' }),
					hotspot('b', { linkedCameraId: 'cam-a' })
				]
			},
			'cam-a'
		)
		expect(cameraIds(result)).toEqual(['main'])
		expect(result?.hotspots.map((h) => h.linkedCameraId)).toEqual([
			undefined,
			undefined
		])
	})

	it('leaves links to other cameras alone', () => {
		const result = removeCamera(
			{
				camera: { cameras: [mainCamera, cameraA, cameraB] },
				hotspots: [
					hotspot('a', { linkedCameraId: 'cam-a' }),
					hotspot('b', { linkedCameraId: 'cam-b' })
				]
			},
			'cam-a'
		)
		expect(result?.hotspots[1].linkedCameraId).toBe('cam-b')
	})

	// The count of cameras says there is plenty left, but the scene would then
	// open on a hotspot camera, because the default falls back to the first
	// entry of any kind.
	it('refuses to take the last scene camera, hotspot cameras notwithstanding', () => {
		const state = {
			camera: { cameras: [mainCamera, cameraA] },
			hotspots: [hotspot('a', { linkedCameraId: 'cam-a' })]
		}
		expect(removeCamera(state, 'main')).toBeNull()
	})

	it('refuses to take the only camera of any kind', () => {
		const state = { camera: { cameras: [mainCamera] }, hotspots: [] }
		expect(removeCamera(state, 'main')).toBeNull()
	})

	it('takes a hotspot camera once other scene cameras remain', () => {
		const result = removeCamera(
			{
				camera: { cameras: [mainCamera, otherCamera, cameraA] },
				hotspots: []
			},
			'cam-a'
		)
		expect(cameraIds(result)).toEqual(['main', 'other'])
	})

	it('leaves the opening view on a surviving scene camera, never a hotspot one', () => {
		const result = removeCamera(
			{
				camera: { cameras: [cameraA, mainCamera, otherCamera] },
				hotspots: []
			},
			'other'
		)
		const survivors = result?.camera.cameras?.map((c) => [
			c.cameraId,
			c.initial
		])
		expect(survivors).toEqual([
			['cam-a', false],
			['main', true]
		])
	})

	it('does not mutate the input', () => {
		const state = {
			camera: { cameras: [mainCamera, cameraA] },
			hotspots: [hotspot('a', { linkedCameraId: 'cam-a' })]
		}
		removeCamera(state, 'cam-a')
		expect(cameraIds(state)).toEqual(['main', 'cam-a'])
		expect(state.hotspots[0].linkedCameraId).toBe('cam-a')
	})
})

describe('repointHotspotLinks', () => {
	it('moves every hotspot onto the new id', () => {
		const result = repointHotspotLinks(
			[
				hotspot('a', { linkedCameraId: 'old' }),
				hotspot('b', { linkedCameraId: 'old' })
			],
			'old',
			'new'
		)
		expect(result.map((h) => h.linkedCameraId)).toEqual(['new', 'new'])
	})

	it('leaves links to other cameras alone', () => {
		const result = repointHotspotLinks(
			[
				hotspot('a', { linkedCameraId: 'old' }),
				hotspot('b', { linkedCameraId: 'default' })
			],
			'old',
			'new'
		)
		expect(result[1].linkedCameraId).toBe('default')
	})

	it('changes nothing when no hotspot points at the old id', () => {
		const hotspots = [hotspot('a', { linkedCameraId: 'default' })]
		expect(repointHotspotLinks(hotspots, 'old', 'new')).toEqual(hotspots)
	})
})
