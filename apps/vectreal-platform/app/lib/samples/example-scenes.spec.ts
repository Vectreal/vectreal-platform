import {
	EXAMPLE_SCENES,
	exampleSceneById,
	exampleSettingsSnippet,
	publisherExampleHref
} from './example-scenes'
import { HERO_MODEL } from './sample-models'

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
