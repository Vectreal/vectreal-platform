import { HERO_MODEL } from './sample-models'
import cameraHeroPreviewUrl from '../../assets/models/camera-hero-preview.webp?url'
import cameraTelephotoPreviewUrl from '../../assets/models/camera-telephoto-preview.webp?url'
import cameraWidePreviewUrl from '../../assets/models/camera-wide-preview.webp?url'
import sheenChairPreviewUrl from '../../assets/models/sheen-chair-preview.webp?url'
import sheenChairUrl from '../../assets/models/sheen-chair.glb?url'

import type { SampleModel } from './sample-models'
import type {
	CameraConfig,
	CameraTransitionConfig,
	SceneSettings
} from '@vctrl/core'

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
	/**
	 * A cutout of the scene from its own opening camera, shown until the reader
	 * asks for the 3D scene, so the poster is the view the scene opens on.
	 */
	previewUrl: string
	settings: SceneSettings
}

/** The Balanced camera the home page draws: 0.9 MB rather than the 18 MB source. */
const CAMERA_MODEL: ExampleScene['model'] = {
	url: HERO_MODEL.url,
	fileName: HERO_MODEL.fileName,
	bytes: HERO_MODEL.bytes
}

/*
  The stage every example stands on. The studio map lights the model
  but is not shown: the shadow lands on the Publisher's default gradient
  instead, rather than on a photo with no floor in it.
*/
const STUDIO_STAGE = {
	environment: {
		preset: 'studio-natural',
		background: false,
		backdrop: { type: 'gradient', top: '#fafafa', bottom: '#d4d4d8' },
		// Kept for anyone who switches the map back on in the Publisher.
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
} satisfies Pick<SceneSettings, 'environment' | 'shadows'>

/** Where the camera model's body sits; every view below aims here or near it. */
const CAMERA_CENTER: [number, number, number] = [0, 0.039, 0]

/*
  A three-quarter view from above, so the shadow falling away from the lens is
  in frame. Auto-fit would open straight on from the front.
*/
const HERO_VIEW: CameraConfig = {
	cameraId: 'default',
	name: 'Hero',
	fov: 60,
	initial: true,
	position: [0.1, 0.11, 0.17],
	target: CAMERA_CENTER
}

const LINEAR_QUICK = {
	type: 'linear',
	duration: 500,
	easing: 'ease_in_out'
} satisfies CameraTransitionConfig

export const EXAMPLE_SCENES: ExampleScene[] = [
	{
		id: 'camera-shadows',
		label: 'Camera with a cast shadow and a ground shadow',
		model: CAMERA_MODEL,
		previewUrl: cameraHeroPreviewUrl,
		settings: {
			camera: {
				activeCameraId: 'default',
				cameras: [{ ...HERO_VIEW, name: 'Default Camera' }],
				sceneTransition: {
					type: 'linear',
					duration: 1000,
					easing: 'ease_in_out'
				}
			},
			...STUDIO_STAGE
		}
	},
	/*
	  Article 05's e-commerce bundle, built: three saved cameras at the three
	  field-of-view stops, a Quick linear move between them, and the default
	  interaction (Balanced, zoom on, auto-rotate off, vertical limit 90°).
	*/
	{
		id: 'camera-three-views',
		label: 'Camera with three saved cameras: Hero, Detail and Context',
		model: CAMERA_MODEL,
		previewUrl: cameraHeroPreviewUrl,
		settings: {
			camera: {
				activeCameraId: 'default',
				cameras: [
					HERO_VIEW,
					{
						cameraId: 'detail',
						name: 'Detail',
						fov: 35,
						position: [0.086, 0.09, 0.25],
						target: [0.02, 0.035, 0.05]
					},
					{
						cameraId: 'context',
						name: 'Context',
						fov: 90,
						position: [-0.16, 0.15, 0.2],
						target: CAMERA_CENTER
					}
				],
				sceneTransition: LINEAR_QUICK
			},
			...STUDIO_STAGE
		}
	},
	/*
	  The field-of-view pair: one direction, the distance set so the model fills
	  about the same share of the frame, so only the perspective differs.
	*/
	{
		id: 'camera-fov-telephoto',
		label: 'Camera seen through a 35° telephoto field of view',
		model: CAMERA_MODEL,
		previewUrl: cameraTelephotoPreviewUrl,
		settings: {
			camera: {
				activeCameraId: 'default',
				cameras: [
					{
						...HERO_VIEW,
						name: 'Telephoto',
						fov: 35,
						position: [0.151, 0.146, 0.257]
					}
				],
				sceneTransition: LINEAR_QUICK
			},
			...STUDIO_STAGE
		}
	},
	{
		id: 'camera-fov-wide',
		label: 'Camera seen through a 90° wide field of view',
		model: CAMERA_MODEL,
		previewUrl: cameraWidePreviewUrl,
		settings: {
			camera: {
				activeCameraId: 'default',
				cameras: [
					{
						...HERO_VIEW,
						name: 'Wide',
						fov: 90,
						position: [0.048, 0.073, 0.081]
					}
				],
				sceneTransition: LINEAR_QUICK
			},
			...STUDIO_STAGE
		}
	},
	/*
	  Three cameras walking round the model on a Slow linear move, so the
	  transition is long enough to watch when the reader switches cameras in the
	  Publisher. Each leg stays clear of the body: a linear move is a straight
	  line, and it would pass through anything in its way.
	*/
	{
		id: 'camera-slow-tour',
		label: 'Camera with three cameras on a slow, smooth transition',
		model: CAMERA_MODEL,
		previewUrl: cameraHeroPreviewUrl,
		settings: {
			camera: {
				activeCameraId: 'default',
				cameras: [
					HERO_VIEW,
					{
						cameraId: 'side',
						name: 'Side',
						fov: 60,
						position: [0.24, 0.06, 0],
						target: CAMERA_CENTER
					},
					{
						cameraId: 'top',
						name: 'Top',
						fov: 60,
						position: [0.02, 0.25, 0.08],
						target: CAMERA_CENTER
					}
				],
				sceneTransition: {
					type: 'linear',
					duration: 2000,
					easing: 'ease_in_out'
				}
			},
			...STUDIO_STAGE
		}
	},
	/*
	  The Interaction tool's showroom setting, felt rather than read: Floaty,
	  auto-rotate on, zoom off. Written out in full because the viewer takes
	  `controls` whole rather than merging it over the defaults.
	*/
	{
		id: 'camera-floaty-showroom',
		label: 'Camera turning on its own, with a floaty drag and zoom off',
		model: CAMERA_MODEL,
		previewUrl: cameraHeroPreviewUrl,
		settings: {
			camera: {
				activeCameraId: 'default',
				cameras: [HERO_VIEW],
				sceneTransition: LINEAR_QUICK
			},
			controls: {
				controlsTimeout: 0,
				maxPolarAngle: Math.PI / 2,
				autoRotate: true,
				autoRotateSpeed: 1,
				enableZoom: false,
				enableDamping: true,
				// INTERACTION_FEELS.floaty, which the spec holds this to.
				dampingFactor: 0.06,
				rotateSpeed: 0.5,
				panSpeed: 0.5,
				zoomSpeed: 0.4,
				makeDefault: true
			},
			...STUDIO_STAGE
		}
	},
	/*
	  Article 15's compressed chair: Khronos's Sheen Chair (© 2020 Wayfair LLC,
	  CC BY 4.0, by Eric Chadwick) with WebP textures and Draco geometry, the
	  exact 0.58 MB file the article measured, so the reader can turn the claim
	  that it looks the same.
	*/
	{
		id: 'sheen-chair-compressed',
		label: 'Sheen Chair at 0.58 MB, with WebP textures and Draco geometry',
		model: {
			url: sheenChairUrl,
			fileName: 'sheen-chair.glb',
			bytes: 576_016
		},
		previewUrl: sheenChairPreviewUrl,
		settings: {
			camera: {
				activeCameraId: 'default',
				cameras: [
					{
						cameraId: 'default',
						name: 'Default Camera',
						fov: 60,
						initial: true,
						position: [0.55, 0.6, 0.95],
						target: [0, 0.32, 0]
					}
				],
				sceneTransition: LINEAR_QUICK
			},
			...STUDIO_STAGE
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
