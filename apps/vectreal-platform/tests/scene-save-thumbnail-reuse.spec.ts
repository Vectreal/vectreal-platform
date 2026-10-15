/**
 * Whether a save relinks the scene's stored thumbnail or takes a new one.
 *
 * Model files are reused only when `prepare-scene-upload` lists them in
 * `existingAssets`, and a save into another project lists nothing, because
 * every asset has to land in the new project's storage. The thumbnail used to
 * skip that rule: it was relinked from the publisher's own state, so a move
 * linked an asset in the old project and the server refused the whole save.
 *
 * This drives the real `executeSceneSaveOrchestrator` against a stubbed API.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ok, stubSceneApi } from './fixtures/scene-api-stub'
import { buildThumbnailFrameSignature } from '../app/lib/domain/scene/client/scene-change-detection'
import { executeSceneSaveOrchestrator } from '../app/lib/domain/scene/client/scene-save-orchestrator'

import type { SceneSettings } from '@vctrl/core'

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const STORED_URL = '/api/scenes/s1/thumbnail/thumb-old'

interface Committed {
	sceneAssetIds: string[]
	thumbnailUrl: string
	/** The image the save uploaded, as a data URL, or null when none was. */
	uploaded: null | string
	captures: number
	/** The camera each capture was taken from; undefined means the live view. */
	captureTargets: (string | undefined)[]
}

async function save(
	existingAssets: Record<string, { assetId: string; contentHash: string }>,
	settings: {
		current?: SceneSettings
		lastSaved?: SceneSettings | null
		/** A capture taken this session and not yet uploaded. */
		pendingCapture?: string
		/** The frame recorded for a capture, as "Set opening view" records it. */
		capturedFrame?: { thumbnailUrl: string; frame: string }
		/** The last save's meta; the stored thumbnail when left out. */
		lastSavedMeta?: null
		/** The save-time capture answers null, as a failed one does. */
		captureFails?: boolean
	} = {}
): Promise<Committed> {
	let sceneAssetIds: string[] = []
	let thumbnailUrl = ''
	let uploaded: null | string = null

	stubSceneApi(async (form) => {
		const action = form.get('action')
		if (action === 'prepare-scene-upload') {
			return ok({ sceneId: 's1', projectId: 'p2', existingAssets })
		}
		if (action === 'upload-scene-asset') {
			const file = form.get('file') as File
			const bytes = Buffer.from(await file.arrayBuffer()).toString('base64')
			uploaded = `data:${file.type};base64,${bytes}`
			return ok({ assetId: 'thumb-new' })
		}
		if (action === 'upload-scene-gltf') return ok({ assetId: 'gltf-1' })
		sceneAssetIds = JSON.parse(String(form.get('sceneAssetIds')))
		thumbnailUrl = JSON.parse(String(form.get('meta'))).thumbnailUrl
		return ok({ sceneId: 's1' })
	})

	const captureSceneThumbnail = vi.fn(
		async (_targetCameraId?: string): Promise<null | string> =>
			settings.captureFails ? null : PNG_DATA_URL
	)
	const meta = { name: 'Chair', description: '', thumbnailUrl: STORED_URL }

	await executeSceneSaveOrchestrator({
		userId: 'u1',
		currentSceneId: 's1',
		currentSettings: settings.current ?? {},
		sceneMetaState: settings.pendingCapture
			? { ...meta, thumbnailUrl: settings.pendingCapture }
			: meta,
		capturedThumbnailFrame: settings.capturedFrame,
		lastSavedSceneMeta: settings.lastSavedMeta === null ? null : meta,
		lastSavedSettings:
			'lastSaved' in settings ? (settings.lastSaved ?? null) : ({} as never),
		optimizationSettings: {},
		optimizationReport: null,
		createRequestId: () => 'req-1',
		prepareGltfDocumentForUpload: async () => ({
			data: { asset: { version: '2.0' } },
			assets: new Map()
		}),
		captureSceneThumbnail,
		options: { targetProjectId: 'p2' }
	})

	return {
		sceneAssetIds,
		thumbnailUrl,
		uploaded,
		captures: captureSceneThumbnail.mock.calls.length,
		captureTargets: captureSceneThumbnail.mock.calls.map(([target]) => target)
	}
}

describe('the stored thumbnail on a save', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('is relinked when the server lists it as reusable', async () => {
		const committed = await save({
			[SCENE_THUMBNAIL_FILENAME]: { assetId: 'thumb-old', contentHash: 'h' }
		})

		expect(committed.captures).toBe(0)
		expect(committed.thumbnailUrl).toBe(STORED_URL)
		expect(committed.sceneAssetIds).toContain('thumb-old')
	})

	it('is replaced by a fresh capture on a save into another project', async () => {
		const committed = await save({})

		expect(committed.captures).toBe(1)
		expect(committed.thumbnailUrl).toBe('/api/scenes/s1/thumbnail/thumb-new')
		expect(committed.sceneAssetIds).toContain('thumb-new')
		expect(committed.sceneAssetIds).not.toContain('thumb-old')
	})
})

/*
  The thumbnail is the placeholder an embed fades out of, so it has to show the
  frame the scene opens into. Recapture used to follow the default camera
  alone, so switching the HDRI background or setting a stage kept a thumbnail
  painted on the old background.
*/
describe('a save after the frame behind the model changed', () => {
	afterEach(() => vi.unstubAllGlobals())

	const reusable = {
		[SCENE_THUMBNAIL_FILENAME]: { assetId: 'thumb-old', contentHash: 'h' }
	}
	const openingCamera = {
		cameraId: 'cam-main',
		name: 'Main',
		position: [2, 1, 4] as [number, number, number],
		target: [0, 0, 0] as [number, number, number],
		fov: 50
	}
	const lastSaved: SceneSettings = {
		camera: { cameras: [openingCamera] },
		environment: { preset: 'studio-key', background: false }
	}
	const withStage: SceneSettings = {
		...lastSaved,
		environment: {
			...lastSaved.environment,
			backdrop: { type: 'color', color: '#f4f4f2' }
		}
	}

	it('recaptures from the opening camera when a stage is set', async () => {
		const committed = await save(reusable, { lastSaved, current: withStage })

		expect(committed.captureTargets).toEqual(['cam-main'])
		expect(committed.thumbnailUrl).toBe('/api/scenes/s1/thumbnail/thumb-new')
	})

	it('recaptures when only the opening camera moved', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: {
				...lastSaved,
				camera: { cameras: [{ ...openingCamera, position: [3, 1, 4] }] }
			}
		})

		expect(committed.captureTargets).toEqual(['cam-main'])
	})

	it('recaptures over a capture taken before the stage changed', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: withStage,
			pendingCapture: 'data:image/webp;base64,c3RhbGU='
		})

		expect(committed.captureTargets).toEqual(['cam-main'])
		expect(committed.uploaded).toBe(PNG_DATA_URL)
	})

	it('uploads the pending capture when the fresh one fails', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: withStage,
			pendingCapture: PNG_DATA_URL,
			captureFails: true
		})

		expect(committed.captures).toBe(1)
		expect(committed.thumbnailUrl).toBe('/api/scenes/s1/thumbnail/thumb-new')
	})

	it('recaptures when only the HDRI preset changed', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: {
				...lastSaved,
				environment: { ...lastSaved.environment, preset: 'studio-soft' }
			}
		})

		expect(committed.captureTargets).toEqual(['cam-main'])
	})

	it('captures from the new opening camera, not a hotspot camera listed first', async () => {
		const hotspotCamera = {
			...openingCamera,
			cameraId: 'hotspot-camera-1',
			kind: 'hotspot' as const
		}
		const secondCamera = { ...openingCamera, cameraId: 'cam-side' }
		const committed = await save(reusable, {
			lastSaved: {
				...lastSaved,
				camera: { cameras: [hotspotCamera, openingCamera, secondCamera] }
			},
			current: {
				...lastSaved,
				camera: { cameras: [hotspotCamera, secondCamera, openingCamera] }
			}
		})

		expect(committed.captureTargets).toEqual(['cam-side'])
	})

	it('recaptures on a stage change when the opening camera has no pose', async () => {
		// The viewer stands a pose-less camera where the scene opened, and a
		// capture from it renders there too, so the new stage gets a new image.
		const poseless = {
			camera: { cameras: [{ cameraId: 'cam-main', name: 'Main', fov: 50 }] }
		}
		const committed = await save(reusable, {
			lastSaved: { ...lastSaved, ...poseless },
			current: { ...withStage, ...poseless }
		})

		expect(committed.captureTargets).toEqual(['cam-main'])
		expect(committed.thumbnailUrl).toBe('/api/scenes/s1/thumbnail/thumb-new')
	})

	it('uploads a pending capture as it is when the frame did not change', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: lastSaved,
			pendingCapture: PNG_DATA_URL
		})

		expect(committed.captures).toBe(0)
		expect(committed.thumbnailUrl).toBe('/api/scenes/s1/thumbnail/thumb-new')
	})

	it('recaptures when the normalization resizes the model', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: { ...lastSaved, normalization: { enabled: true, maxSize: 2 } }
		})

		expect(committed.captureTargets).toEqual(['cam-main'])
	})

	it('recaptures when the HDRI is switched on as the background', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: {
				...lastSaved,
				environment: { ...lastSaved.environment, background: true }
			}
		})

		expect(committed.captureTargets).toEqual(['cam-main'])
	})

	it('keeps the thumbnail when only the key order differs', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: {
				...lastSaved,
				environment: { background: false, preset: 'studio-key' }
			}
		})

		expect(committed.captures).toBe(0)
		expect(committed.thumbnailUrl).toBe(STORED_URL)
	})

	it('keeps the thumbnail when nothing it paints changed', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: { ...lastSaved, controls: { autoRotate: true } }
		})

		expect(committed.captures).toBe(0)
	})
})

/*
  "Set opening view" moves the default camera and captures the image in one
  step, so the frame always differs from the last save's. The image it captured
  is the one the user approved, and a save renders it again only when the frame
  moved on after the capture.
*/
describe('a save after "Set opening view"', () => {
	afterEach(() => vi.unstubAllGlobals())

	const reusable = {
		[SCENE_THUMBNAIL_FILENAME]: { assetId: 'thumb-old', contentHash: 'h' }
	}
	const lastSaved: SceneSettings = {
		camera: {
			cameras: [
				{ cameraId: 'cam-main', name: 'Main', position: [2, 1, 4], fov: 50 }
			]
		},
		environment: { preset: 'studio-key', background: false }
	}
	const opened: SceneSettings = {
		...lastSaved,
		camera: {
			cameras: [
				{ cameraId: 'cam-main', name: 'Main', position: [3, 1, 4], fov: 50 }
			]
		}
	}
	const approved = 'data:image/png;base64,YXBwcm92ZWQ='
	const recorded = {
		thumbnailUrl: approved,
		frame: buildThumbnailFrameSignature(opened)
	}

	it('uploads the approved capture without rendering again', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: opened,
			pendingCapture: approved,
			capturedFrame: recorded
		})

		expect(committed.captures).toBe(0)
		expect(committed.uploaded).toBe(approved)
	})

	it('keeps the stored thumbnail when the camera went back to its saved pose', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: lastSaved,
			pendingCapture: approved,
			capturedFrame: recorded
		})

		expect(committed.uploaded).toBeNull()
		expect(committed.thumbnailUrl).toBe(STORED_URL)
	})

	it('uploads the approved capture on a first save', async () => {
		const committed = await save(
			{},
			{
				lastSaved: null,
				lastSavedMeta: null,
				current: opened,
				pendingCapture: approved,
				capturedFrame: recorded
			}
		)

		expect(committed.captures).toBe(0)
		expect(committed.thumbnailUrl).toBe('/api/scenes/s1/thumbnail/thumb-new')
	})

	it('recaptures when the stage changed after the capture', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: {
				...opened,
				environment: { ...opened.environment, background: true }
			},
			pendingCapture: approved,
			capturedFrame: recorded
		})

		expect(committed.captureTargets).toEqual(['cam-main'])
	})

	it('recaptures when the record belongs to another capture', async () => {
		const committed = await save(reusable, {
			lastSaved,
			current: opened,
			pendingCapture: approved,
			capturedFrame: { ...recorded, thumbnailUrl: PNG_DATA_URL }
		})

		expect(committed.captureTargets).toEqual(['cam-main'])
	})
})

/*
  The orchestrator names the camera; the publisher hook has to hand it to the
  viewer, or every save-time capture silently falls back to the live view.
*/
describe('the publisher capture a save takes', () => {
	it('passes the camera the save names to the viewer', () => {
		const hook = readFileSync(
			join(import.meta.dirname, '..', 'app', 'hooks', 'use-publisher-scene.ts'),
			'utf8'
		)

		expect(hook).toMatch(
			/async \(targetCameraId\?: string\) => \{\s*try \{\s*return await requestSceneScreenshot\(\{\s*\.\.\.OPENING_VIEW_CAPTURE_OPTIONS,\s*targetCameraId\s*\}\)/
		)
	})
})
