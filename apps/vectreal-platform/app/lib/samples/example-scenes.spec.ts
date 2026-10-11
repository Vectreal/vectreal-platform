import {
	EXAMPLE_SCENES,
	exampleSceneById,
	exampleSettingsSnippet,
	publisherExampleHref
} from './example-scenes'
import { HERO_MODEL } from './sample-models'
import {
	defaultControlsOptions,
	INTERACTION_FEELS
} from '../../constants/viewer-defaults'

describe('example scenes', () => {
	it('gives every example a unique id a link can name', () => {
		const ids = EXAMPLE_SCENES.map((example) => example.id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const id of ids) {
			expect(exampleSceneById(id)?.id).toBe(id)
			expect(publisherExampleHref(id)).toBe(`/publisher?example=${id}`)
		}
	})

	it('serves the camera example from the file the hero figures are pinned to', () => {
		// `sample-models.spec.ts` reads HERO_MODEL back from disk, so this size is a checked claim.
		expect(exampleSceneById('camera-shadows')?.model).toEqual({
			url: HERO_MODEL.url,
			fileName: HERO_MODEL.fileName,
			bytes: HERO_MODEL.bytes
		})
	})
})

describe('example cameras', () => {
	it('opens every example on exactly one camera it has', () => {
		for (const example of EXAMPLE_SCENES) {
			const { activeCameraId, cameras = [] } = example.settings.camera ?? {}
			const ids = cameras.map((camera) => camera.cameraId)
			expect(new Set(ids).size, example.id).toBe(ids.length)
			expect(ids, example.id).toContain(activeCameraId)
			expect(
				cameras.filter((camera) => camera.initial),
				example.id
			).toHaveLength(1)
		}
	})

	it('gives the showroom the Publisher’s Floaty feel, with nothing else left out', () => {
		// The viewer takes `controls` whole, so a missing key is a default lost,
		// and the Interaction tool only reads Floaty off these exact numbers.
		expect(
			exampleSceneById('camera-floaty-showroom')?.settings.controls
		).toEqual({
			...defaultControlsOptions,
			...INTERACTION_FEELS.floaty,
			autoRotate: true,
			autoRotateSpeed: 1,
			enableZoom: false
		})
	})
})

describe('exampleSettingsSnippet', () => {
	it('round-trips the settings, without a shadow bake an example could never load', () => {
		const snippet = exampleSettingsSnippet({
			shadows: {
				enabled: true,
				baked: { assetId: 'asset-1', signature: 'sig' }
			},
			environment: { preset: 'studio-soft' }
		})

		expect(JSON.parse(snippet)).toEqual({
			shadows: { enabled: true },
			environment: { preset: 'studio-soft' }
		})
	})

	it('adds no shadows group to settings that had none', () => {
		expect(JSON.parse(exampleSettingsSnippet({}))).toEqual({})
	})
})
