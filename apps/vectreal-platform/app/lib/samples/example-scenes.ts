import { HERO_MODEL } from './sample-models'
import cameraPreviewUrl from '../../assets/models/camera-preview.webp?url'

import type { SampleModel } from './sample-models'
import type { SceneSettings } from '@vctrl/core'

/**
 * Scenes a page can show working, and hand to the publisher as they are.
 *
 * A sample is a model; an example is a model plus the settings a page is
 * talking about. The article or docs page renders it with `<ExampleScene>`, and
 * `publisherExampleHref` opens the same file with the same settings in the
 * publisher, unsaved, so the reader can change what the page just described.
 *
 * Static on purpose. Nothing here is a published scene: there is no account
 * behind it, no server route and nothing to authorize, and the page and the
 * publisher read one entry, so they cannot drift apart.
 *
 * To add one, set the scene up in the publisher and use its dev-only
 * "Copy as example" control, which copies `settings` in this shape.
 */
export interface ExampleScene {
	id: string
	/** Names the scene for a screen reader and in the publisher's toasts. */
	label: string
	model: Pick<SampleModel, 'url' | 'fileName' | 'bytes'>
	/** A capture of the model, shown until the reader asks for the 3D scene. */
	previewUrl: string
	settings: SceneSettings
}

export const EXAMPLE_SCENES: ExampleScene[] = [
	{
		id: 'camera-shadows',
		label: 'Camera with a cast shadow and a ground shadow',
		// The Balanced camera the home page draws: 0.9 MB rather than the 18 MB source.
		model: {
			url: HERO_MODEL.url,
			fileName: HERO_MODEL.fileName,
			bytes: HERO_MODEL.bytes
		},
		// The camera sample's capture: the same model, before the Balanced preset.
		previewUrl: cameraPreviewUrl,
		settings: {
			/*
			  Posed rather than auto-fit: with shadows on from the first frame,
			  the viewer's fit takes in the shadow plane, 2.5 times the model's
			  footprint, and the camera opens as a speck.
			*/
			camera: {
				activeCameraId: 'default',
				cameras: [
					{
						cameraId: 'default',
						name: 'Default Camera',
						fov: 60,
						initial: true,
						position: [0.1, 0.11, 0.17],
						target: [0, 0.039, 0]
					}
				],
				sceneTransition: {
					type: 'linear',
					duration: 1000,
					easing: 'ease_in_out'
				}
			},
			// The background shown: a shadow darkens what is behind it, and the default void is already dark.
			environment: {
				preset: 'studio-natural',
				background: true,
				backgroundBlurriness: 0.5,
				backgroundIntensity: 1,
				environmentIntensity: 1,
				environmentResolution: '1k'
			},
			// Cast shadows on the Studio preset, with Ground shadow on beneath it.
			shadows: {
				enabled: true,
				opacity: 0.9,
				light: { ambient: 0.3, radius: 0.8, position: [2, 3, 2] },
				contact: { enabled: true }
			}
		}
	}
]

/** The publisher's search param that opens an example on arrival. */
export const PUBLISHER_EXAMPLE_PARAM = 'example'

export const publisherExampleHref = (id: string) =>
	`/publisher?${PUBLISHER_EXAMPLE_PARAM}=${encodeURIComponent(id)}`

export function exampleSceneById(id: string): ExampleScene | null {
	return EXAMPLE_SCENES.find((example) => example.id === id) ?? null
}

/**
 * The publisher's current settings as an `EXAMPLE_SCENES` entry's `settings`,
 * for the dev-only "Copy as example" control.
 *
 * The persisted shadow bake is dropped: it names an asset in storage that an
 * example, which has no scene behind it, can never load. The viewer bakes the
 * shadow on arrival instead, as it does for any unsaved scene.
 */
export function exampleSettingsSnippet(settings: SceneSettings): string {
	const { baked: _baked, ...shadows } = settings.shadows ?? {}
	return JSON.stringify(
		{ ...settings, ...(settings.shadows ? { shadows } : {}) },
		null,
		'\t'
	)
}
