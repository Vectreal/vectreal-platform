import { describe, expect, it } from 'vitest'

import {
	isPairedHotspotCameraId,
	redactSettingsForEmbed
} from '../app/lib/domain/scene/embed-settings-policy'

import type { SceneSettings } from '@vctrl/core'

const BAKE_ASSET_ID = 'bake-id'

function buildSettings(overrides: Partial<SceneSettings> = {}): SceneSettings {
	return {
		camera: {
			activeCameraId: 'cam-scene',
			cameras: [
				{ cameraId: 'cam-scene', name: 'Default', kind: 'scene' },
				{ cameraId: 'cam-legacy', name: 'Legacy, no kind' },
				{
					cameraId: 'cam-public-hotspot',
					name: 'Sole detail',
					kind: 'hotspot',
					position: [1, 1, 1],
					target: [0, 0, 0]
				},
				{
					cameraId: 'cam-backstage',
					name: 'Backstage rig',
					kind: 'hotspot',
					position: [9, 9, 9],
					target: [0, 0, 0]
				},
				/*
				  The shape the publisher produced before it started tagging paired
				  cameras: no `kind` at all, so `isSceneCamera` reads it as a scene
				  camera. Every scene saved before that fix has one of these.
				*/
				{
					cameraId: 'hotspot-camera-1755123456789-a1b2',
					name: 'Legacy backstage rig',
					position: [8, 8, 8],
					target: [0, 0, 0]
				},
				{ cameraId: 'cam-orphan', name: 'Orphaned hotspot cam', kind: 'hotspot' }
			]
		},
		hotspots: [
			{
				id: 'h-public',
				name: 'Sole',
				worldPosition: [0, 0, 0],
				linkedCameraId: 'cam-public-hotspot',
				visible: true,
				internalOnly: false,
				stylePreset: 'dot'
			},
			{
				id: 'h-internal',
				name: 'Backstage note',
				worldPosition: [1, 1, 1],
				linkedCameraId: 'cam-backstage',
				visible: true,
				internalOnly: true,
				stylePreset: 'dot'
			},
			{
				id: 'h-internal-legacy',
				name: 'Legacy backstage note',
				worldPosition: [2, 2, 2],
				linkedCameraId: 'hotspot-camera-1755123456789-a1b2',
				visible: true,
				internalOnly: true,
				stylePreset: 'dot'
			}
		],
		interactions: [
			{
				id: 'i-public',
				trigger: { source: 'viewer', type: 'viewer_ready' },
				actions: [{ type: 'activate_camera', cameraId: 'cam-scene' }]
			},
			{
				id: 'i-internal',
				trigger: { source: 'viewer', type: 'viewer_ready' },
				actions: [{ type: 'activate_camera', cameraId: 'cam-backstage' }]
			},
			{
				id: 'i-mixed',
				trigger: { source: 'viewer', type: 'viewer_ready' },
				actions: [
					{ type: 'activate_camera', cameraId: 'cam-backstage' },
					{ type: 'set_controls_enabled', enabled: false }
				]
			}
		],
		shadows: {
			baked: { assetId: BAKE_ASSET_ID, signature: 'sig-1' }
		},
		...overrides
	} as SceneSettings
}

const redact = (settings: SceneSettings, bakeAssetId: string | null = BAKE_ASSET_ID) =>
	redactSettingsForEmbed(settings, { bakeAssetId })

describe('paired hotspot camera ids', () => {
	it('recognizes the shape the publisher mints', () => {
		expect(isPairedHotspotCameraId('hotspot-camera-1755123456789-a1b2')).toBe(
			true
		)
		expect(isPairedHotspotCameraId('hotspot-camera-1755123456789-a')).toBe(true)
	})

	/**
	 * Ordinary camera ids are slugified from the user's camera name, so the bare
	 * prefix is not a safe test - these are all names someone might type.
	 */
	it('does not claim ids that merely slugify to the same prefix', () => {
		for (const cameraId of [
			'hotspot-camera-1',
			'hotspot-camera-2',
			'hotspot-camera-view',
			'hotspot-camera',
			'hotspot-camera-front-detail'
		]) {
			expect(isPairedHotspotCameraId(cameraId), cameraId).toBe(false)
		}
	})
})

describe('embed settings policy', () => {
	it('drops internalOnly hotspots', () => {
		const result = redact(buildSettings())

		expect(result.hotspots?.map((hotspot) => hotspot.id)).toEqual(['h-public'])
	})

	/**
	 * The regression that matters most. The publisher only started tagging paired
	 * cameras `kind: 'hotspot'` recently, so every scene already in the database
	 * has an untagged one - and `isSceneCamera` reads a missing `kind` as
	 * "scene". A `kind`-based filter keeps exactly the cameras this redaction
	 * exists to remove, for exactly the scenes that exist today.
	 */
	it('drops an untagged camera an internalOnly hotspot links to', () => {
		const result = redact(buildSettings())

		expect(
			result.camera?.cameras?.map((camera) => camera.cameraId)
		).not.toContain('hotspot-camera-1755123456789-a1b2')
		expect(JSON.stringify(result)).not.toContain('Legacy backstage rig')
	})

	/**
	 * Filtering the hotspot array alone is not enough. The linked camera carries
	 * the viewpoint's pose and name, and `@vctrl/embed` exposes
	 * `activateCamera(cameraId)` publicly - so leaving the camera behind lets any
	 * third-party page read the hidden viewpoint and fly a visitor to it.
	 */
	it('drops the camera an internalOnly hotspot linked to', () => {
		const result = redact(buildSettings())
		const cameraIds = result.camera?.cameras?.map((camera) => camera.cameraId)

		expect(cameraIds).not.toContain('cam-backstage')
		expect(JSON.stringify(result)).not.toContain('Backstage rig')
	})

	it('keeps scene cameras, legacy kind-less cameras, and visible hotspot cameras', () => {
		const result = redact(buildSettings())

		expect(result.camera?.cameras?.map((camera) => camera.cameraId)).toEqual([
			'cam-scene',
			'cam-legacy',
			'cam-public-hotspot'
		])
	})

	it('drops an orphaned hotspot camera no surviving hotspot links to', () => {
		const result = redact(buildSettings())

		expect(
			result.camera?.cameras?.map((camera) => camera.cameraId)
		).not.toContain('cam-orphan')
	})

	it('drops interactions that would activate a removed camera', () => {
		const result = redact(buildSettings())

		expect(result.interactions?.map((interaction) => interaction.id)).toEqual([
			'i-public',
			'i-mixed'
		])
	})

	it('keeps the surviving actions of a partially removed interaction', () => {
		const result = redact(buildSettings())
		const mixed = result.interactions?.find(
			(interaction) => interaction.id === 'i-mixed'
		)

		expect(mixed?.actions).toEqual([
			{ type: 'set_controls_enabled', enabled: false }
		])
	})

	it('clears an active camera selection that pointed at a removed camera', () => {
		const settings = buildSettings()
		settings.camera!.activeCameraId = 'cam-backstage'

		expect(redact(settings).camera?.activeCameraId).toBeUndefined()
	})

	it('keeps an active camera selection that survived', () => {
		expect(redact(buildSettings()).camera?.activeCameraId).toBe('cam-scene')
	})

	describe('baked shadow pointer', () => {
		it('keeps the pointer the asset gate authorized', () => {
			expect(redact(buildSettings()).shadows?.baked?.assetId).toBe(BAKE_ASSET_ID)
		})

		/**
		 * A stale or tampered pointer is unfetchable anyway - the asset gate
		 * re-derives the servable set server-side - so shipping the id would leak
		 * an internal identifier for no benefit.
		 */
		it('drops a pointer the asset gate refused', () => {
			expect(redact(buildSettings(), null).shadows?.baked).toBeUndefined()
			expect(
				redact(buildSettings(), 'some-other-id').shadows?.baked
			).toBeUndefined()
		})

		it('leaves the rest of the shadow settings alone', () => {
			const settings = buildSettings({
				shadows: {
					ao: true,
					aoIntensity: 1.4,
					baked: { assetId: 'stale', signature: 'sig' }
				}
			})

			const result = redact(settings, null)

			expect(result.shadows?.ao).toBe(true)
			expect(result.shadows?.aoIntensity).toBe(1.4)
		})
	})

	/**
	 * A hotspot may link any camera the author picks - the publisher's picker
	 * offers every camera and the server validates only that the id exists. If
	 * linkage alone promoted a camera to "hotspot camera", one internal hotspot
	 * pointed at the scene's default view would delete that view from the embed.
	 * The camera is a scene camera in its own right; only the hotspot hides.
	 */
	it('keeps a scene camera an internalOnly hotspot happens to link', () => {
		const settings = buildSettings({
			camera: {
				activeCameraId: 'cam-default',
				cameras: [{ cameraId: 'cam-default', name: 'Default', kind: 'scene' }]
			},
			hotspots: [
				{
					id: 'h-note',
					name: 'Editor note on the default view',
					worldPosition: [0, 0, 0],
					linkedCameraId: 'cam-default',
					visible: true,
					internalOnly: true,
					stylePreset: 'dot'
				}
			],
			interactions: []
		})

		const result = redact(settings, null)

		expect(result.camera?.cameras?.map((camera) => camera.cameraId)).toEqual([
			'cam-default'
		])
		expect(result.camera?.activeCameraId).toBe('cam-default')
		expect(result.hotspots).toEqual([])
	})

	it('keeps an untagged ordinary camera an internalOnly hotspot links', () => {
		const settings = buildSettings({
			camera: {
				cameras: [{ cameraId: 'camera-2', name: 'Bookmark' }]
			},
			hotspots: [
				{
					id: 'h-note',
					name: 'Note',
					worldPosition: [0, 0, 0],
					linkedCameraId: 'camera-2',
					visible: true,
					internalOnly: true,
					stylePreset: 'dot'
				}
			],
			interactions: []
		})

		expect(
			redact(settings, null).camera?.cameras?.map((camera) => camera.cameraId)
		).toEqual(['camera-2'])
	})

	it('keeps a hotspot camera linked by both a visible and an internal hotspot', () => {
		const settings = buildSettings({
			camera: {
				cameras: [{ cameraId: 'cam-shared', name: 'Shared', kind: 'hotspot' }]
			},
			hotspots: [
				{
					id: 'h-visible',
					name: 'Visible',
					worldPosition: [0, 0, 0],
					linkedCameraId: 'cam-shared',
					visible: true,
					internalOnly: false,
					stylePreset: 'dot'
				},
				{
					id: 'h-internal',
					name: 'Internal',
					worldPosition: [1, 1, 1],
					linkedCameraId: 'cam-shared',
					visible: true,
					internalOnly: true,
					stylePreset: 'dot'
				}
			],
			interactions: []
		})

		expect(
			redact(settings, null).camera?.cameras?.map((camera) => camera.cameraId)
		).toEqual(['cam-shared'])
	})

	/**
	 * Ordinary camera ids are slugified from the user's camera name, so a camera
	 * simply named "Hotspot Camera 1" gets the id `hotspot-camera-1`. Matching on
	 * the bare prefix would drop it from the embed while the publisher, the
	 * dashboard and `/preview` all still showed it.
	 */
	it('keeps a camera whose slugified name only looks like a paired id', () => {
		const settings = buildSettings({
			camera: {
				activeCameraId: 'hotspot-camera-1',
				cameras: [{ cameraId: 'hotspot-camera-1', name: 'Hotspot Camera 1' }]
			},
			hotspots: [],
			interactions: []
		})

		const result = redact(settings, null)

		expect(result.camera?.cameras?.map((camera) => camera.cameraId)).toEqual([
			'hotspot-camera-1'
		])
		expect(result.camera?.activeCameraId).toBe('hotspot-camera-1')
	})

	it('drops an unlinked camera carrying a publisher-minted paired id', () => {
		const settings = buildSettings({
			camera: {
				cameras: [
					{ cameraId: 'cam-main', name: 'Main', kind: 'scene' },
					{
						cameraId: 'hotspot-camera-1755123456789-zz99',
						name: 'Stranded pair'
					}
				]
			},
			hotspots: [],
			interactions: []
		})

		expect(
			redact(settings, null).camera?.cameras?.map((camera) => camera.cameraId)
		).toEqual(['cam-main'])
	})

	it('keeps a minted paired camera a visible hotspot links', () => {
		const settings = buildSettings({
			camera: {
				cameras: [
					{ cameraId: 'hotspot-camera-1755123456789-aaaa', name: 'Sole detail' }
				]
			},
			hotspots: [
				{
					id: 'h-visible',
					name: 'Sole',
					worldPosition: [0, 0, 0],
					linkedCameraId: 'hotspot-camera-1755123456789-aaaa',
					visible: true,
					internalOnly: false,
					stylePreset: 'dot'
				}
			],
			interactions: []
		})

		expect(
			redact(settings, null).camera?.cameras?.map((camera) => camera.cameraId)
		).toEqual(['hotspot-camera-1755123456789-aaaa'])
	})

	it('passes through a scene with no hotspots, cameras or interactions', () => {
		const settings = { controls: { autoRotate: true } } as SceneSettings

		expect(redact(settings, null)).toEqual({
			controls: { autoRotate: true },
			hotspots: undefined,
			camera: undefined,
			interactions: undefined,
			shadows: undefined
		})
	})
})
