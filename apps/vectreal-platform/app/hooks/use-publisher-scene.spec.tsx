// @vitest-environment jsdom
/**
 * What the publisher reports as unsaved, from the first render of a scene.
 *
 * The bug this covers: the save baseline is written from the route's manifest
 * in a passive effect, so the first commit had nothing to diff against and
 * reported the scene dirty before the user had touched it, arming the
 * navigation guard on every open. An upload has no baseline either, and that
 * one really is unsaved, so both cases are pinned here.
 */

import { render, act } from '@testing-library/react'
import { createStore } from 'jotai'
import { Provider, useAtomValue } from 'jotai/react'
import { describe, expect, it, vi } from 'vitest'

import { usePublisherScene } from './use-publisher-scene'
import { PublisherViewerCaptureProvider } from '../components/publisher/publisher-viewer-capture-context'
import { originalPreset, smallestPreset } from '../constants/optimizations'
import { defaultBoundsOptions } from '../constants/viewer-defaults'
import {
	hasUnsavedChangesAtom,
	lastSavedSceneIdAtom
} from '../lib/stores/publisher-config-store'
import {
	keptOriginalAtom,
	optimizationAtom
} from '../lib/stores/scene-optimization-store'
import { boundsAtom } from '../lib/stores/scene-settings-store'

import type { SaveAvailabilityState } from '../lib/domain/scene'
import type { SceneManifestResponse } from '../types/api'
import type { SceneSettings } from '@vctrl/core'

const { modelContext, sceneDraft, sceneUpload } = vi.hoisted(() => ({
	modelContext: {
		status: 'ready',
		load: vi.fn().mockResolvedValue({ status: 'idle' }),
		reset: vi.fn(),
		// The upload a just-saved scene still holds as its source.
		optimizer: { getSource: () => new Uint8Array([1, 2, 3]) }
	},
	sceneDraft: {
		isRestoringDraft: false,
		persistPendingSceneDraft: vi.fn()
	},
	sceneUpload: { uploadFiles: vi.fn() }
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => modelContext
}))

vi.mock('react-router', () => ({
	useRevalidator: () => ({ revalidate: vi.fn() })
}))

vi.mock('./scene-loader/use-scene-draft', () => ({
	useSceneDraft: () => sceneDraft
}))

vi.mock('./scene-loader/use-scene-upload', () => ({
	useSceneUpload: () => sceneUpload
}))

vi.mock('./scene-loader/use-scene-document-export', () => ({
	usePrepareGltfDocument: () => vi.fn()
}))

const createManifest = (
	settings: SceneSettings | null
): SceneManifestResponse => ({
	sceneId: 'scene-1',
	meta: { name: 'Saved scene', description: '', thumbnailUrl: '' },
	stats: null,
	gltfJson: null,
	assetRefs: null,
	assets: null,
	settings,
	settingsUpdatedAt: null,
	source: null
})

interface SaveSample {
	hasUnsavedChanges: boolean
	saveAvailability: SaveAvailabilityState
}

interface ProbeProps {
	samples: SaveSample[]
	sceneId: null | string
	sceneManifest: SceneManifestResponse | null
}

function Probe({ samples, sceneId, sceneManifest }: ProbeProps) {
	const { saveAvailability } = usePublisherScene({
		sceneId,
		userId: 'user-1',
		sceneManifest
	})
	const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom)

	samples.push({ hasUnsavedChanges, saveAvailability })

	return null
}

/** Opens the publisher and records what it reported on every render. */
function open(
	sceneId: null | string,
	sceneManifest: SceneManifestResponse | null,
	seed?: (store: ReturnType<typeof createStore>) => void
) {
	const samples: SaveSample[] = []
	const store = createStore()
	seed?.(store)

	render(
		<Provider store={store}>
			<PublisherViewerCaptureProvider>
				<Probe
					samples={samples}
					sceneId={sceneId}
					sceneManifest={sceneManifest}
				/>
			</PublisherViewerCaptureProvider>
		</Provider>
	)

	return {
		store,
		samples,
		latest: () => samples[samples.length - 1]
	}
}

describe('usePublisherScene', () => {
	it('never reports a saved scene as unsaved while its baseline hydrates', () => {
		const scene = open(
			'scene-1',
			createManifest({ bounds: { ...defaultBoundsOptions, margin: 1.25 } })
		)

		expect(scene.samples.length).toBeGreaterThan(0)
		expect(
			scene.samples.filter(
				(sample) => sample.hasUnsavedChanges || sample.saveAvailability.canSave
			)
		).toEqual([])
	})

	it('reports an upload as unsaved, since nothing about it is saved yet', () => {
		const upload = open(null, null)

		expect(upload.latest().hasUnsavedChanges).toBe(true)
		expect(upload.latest().saveAvailability.canSave).toBe(true)
	})

	/* Parsing counts as nothing on the stage: the panel is open by then, and signed out its Save would keep an empty draft. */
	it('offers nothing to save until a model is on the stage, parsing included', () => {
		for (const status of ['empty', 'loading'] as const) {
			modelContext.status = status
			try {
				const stage = open(null, null)

				expect(stage.latest().saveAvailability, status).toEqual({
					canSave: false,
					reason: 'no-model'
				})
			} finally {
				modelContext.status = 'ready'
			}
		}
	})

	it('gives a scene saved without settings a baseline, so an edit is savable', () => {
		const scene = open('scene-1', createManifest(null))

		expect(scene.latest().saveAvailability.canSave).toBe(false)

		act(() =>
			scene.store.set(boundsAtom, { ...defaultBoundsOptions, margin: 2.5 })
		)

		expect(scene.latest().saveAvailability.canSave).toBe(true)
	})

	it('never fetches back the original a first save just kept', () => {
		const savedJustNow = {
			keep: true,
			stored: null,
			saved: true,
			unreadable: false
		}
		const scene = open(
			'scene-1',
			{
				...createManifest({ bounds: defaultBoundsOptions }),
				source: {
					assetId: 'original-1',
					url: '/api/scenes/scene-1/assets/original-1',
					fileName: 'source.glb',
					mimeType: 'model/gltf-binary',
					byteSize: 3
				}
			},
			(store) => {
				store.set(lastSavedSceneIdAtom, 'scene-1')
				store.set(keptOriginalAtom, savedJustNow)
			}
		)

		expect(scene.store.get(keptOriginalAtom)).toEqual(savedJustNow)
	})

	// The first save leaves the upload loaded: the optimizer's source is still
	// the original, whatever the saved settings say. Reading it as the saved
	// version would hide the original, and the next save would drop it.
	it("keeps a just-saved scene's upload as its original", () => {
		const scene = open(
			'scene-1',
			{
				...createManifest({ bounds: defaultBoundsOptions }),
				stats: {
					optimizationSettings: smallestPreset
				} as SceneManifestResponse['stats'],
				source: {
					assetId: 'original-1',
					url: '/api/scenes/scene-1/assets/original-1',
					fileName: 'source.glb',
					mimeType: 'model/gltf-binary',
					byteSize: 3
				}
			},
			(store) => {
				store.set(lastSavedSceneIdAtom, 'scene-1')
				store.set(keptOriginalAtom, {
					keep: true,
					stored: null,
					saved: true,
					unreadable: false
				})
				store.set(optimizationAtom, (prev) => ({
					...prev,
					sourceSettings: originalPreset,
					derivedFrom: smallestPreset
				}))
			}
		)

		expect(scene.store.get(optimizationAtom).sourceSettings).toBe(
			originalPreset
		)
		expect(scene.latest().saveAvailability.canSave).toBe(false)
	})

	it('offers a save once the author lets go of a kept original', () => {
		const scene = open('scene-1', {
			...createManifest({ bounds: defaultBoundsOptions }),
			source: {
				assetId: 'original-1',
				url: '/api/scenes/scene-1/assets/original-1',
				fileName: 'source.glb',
				mimeType: 'model/gltf-binary',
				byteSize: 3
			}
		})

		expect(scene.latest().saveAvailability.canSave).toBe(false)

		act(() =>
			scene.store.set(keptOriginalAtom, (prev) => ({ ...prev, keep: false }))
		)

		expect(scene.latest().saveAvailability.canSave).toBe(true)
	})
})
