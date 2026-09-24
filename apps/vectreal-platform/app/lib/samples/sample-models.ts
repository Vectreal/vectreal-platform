import cameraPreviewUrl from '../../assets/models/camera-preview.webp?url'
import cameraSourceUrl from '../../assets/models/camera-source.glb?url'
import cameraUrl from '../../assets/models/camera.glb?url'
import rocketPreviewUrl from '../../assets/models/rocket-preview.webp?url'
import rocketUrl from '../../assets/models/rocket-v3.glb?url'

/**
 * Models anyone can try without handing over their own work.
 *
 * WHY TWO, AND WHY THESE TWO. The converter offers two passes that do different
 * jobs - Draco compresses geometry, WebP recompresses textures - and a single
 * sample can only demonstrate one of them. These were picked by measuring the
 * split rather than by eye:
 *
 *   rocket-v3.glb       0.92 MB total,  0.31 MB of it textures (34%), 2 images
 *   camera-source.glb  17.89 MB total, 17.24 MB of it textures (96%), 9 images
 *
 * So the rocket is two thirds geometry and shows what Draco is for, and the
 * camera is nearly all texture, nine 4K JPEGs, and shows what WebP is for.
 * Running the wrong pass on either is the instructive half: it is how someone
 * learns the passes are not interchangeable.
 *
 * The camera is also the model the home page draws, untouched: the same file
 * the hero's "Original" figure describes, so what a visitor opens here is what
 * the page said it started from.
 *
 * `sample-models.spec.ts` pins `bytes` against the files on disk, because a
 * figure shown in the UI beside a download is a claim.
 *
 * The URLs are Vite `?url` imports, so the bytes are fetched on click and never
 * on load. That matters for the 18 MB one.
 *
 * WHY EACH ONE ALSO CARRIES A PICTURE. Offering a 3D model as underlined text
 * is asking someone to click a thing they cannot see, on a page whose entire
 * argument is that we render 3D well. The previews are captures of these exact
 * models taken through the viewer's own `captureScreenshot`, so they are not an
 * illustration of the model - they are what the stage will show a second after
 * the click. They are trimmed to the model on a transparent background, which
 * is what lets one file sit on both the light and the dark surface.
 */
export interface SampleModel {
	id: string
	/** Emitted asset URL. Fetched only when someone asks for it. */
	url: string
	/** The name the model arrives under, so the download is named after it. */
	fileName: string
	label: string
	/** Size on disk, in bytes. Pinned by the spec. */
	bytes: number
	/** What this model is good for seeing, in one clause. */
	hint: string
	/** A render of this model, trimmed, on a transparent background. */
	previewUrl: string
}

export const SAMPLE_MODELS: SampleModel[] = [
	{
		id: 'rocket',
		url: rocketUrl,
		fileName: 'rocket.glb',
		label: 'Rocket',
		bytes: 966_224,
		hint: 'mostly geometry',
		previewUrl: rocketPreviewUrl
	},
	{
		id: 'camera',
		url: cameraSourceUrl,
		fileName: 'camera.glb',
		label: 'Camera',
		bytes: 18_758_168,
		hint: 'nine 4K textures',
		previewUrl: cameraPreviewUrl
	}
]

/** The camera sample: the hero model before optimization. */
export const HERO_SOURCE_SAMPLE_ID = 'camera'

/** The publisher's search param that opens a sample on arrival, so a plain link can hand someone a model. */
export const PUBLISHER_SAMPLE_PARAM = 'sample'

export const publisherSampleHref = (id: string) =>
	`/publisher?${PUBLISHER_SAMPLE_PARAM}=${encodeURIComponent(id)}`

export function sampleModelById(id: string): SampleModel | null {
	return SAMPLE_MODELS.find((sample) => sample.id === id) ?? null
}

/**
 * Fetches a sample as a `File`, ready for the same load path a dropped file
 * takes. Nothing about it is special-cased downstream: it is a real GLB going
 * through the real loader, which is the only version worth offering.
 */
export async function fetchSampleModel(sample: SampleModel): Promise<File> {
	const response = await fetch(sample.url)

	if (!response.ok) {
		throw new Error(`Sample fetch failed: ${response.status}`)
	}

	return new File([await response.blob()], sample.fileName, {
		type: 'model/gltf-binary'
	})
}

/**
 * The model the home page draws: Poly Haven's Camera_01, CC0.
 *
 * The optimized file, which is what the hero downloads. Its source is the
 * camera in `SAMPLE_MODELS`: that one is untouched, so the converter and the
 * publisher have something to show on it, and this one would show almost
 * nothing.
 *
 * WHAT WAS DONE TO IT. The 4k source was packed into one GLB with the strap
 * removed, and the maker's engravings (brand, model and serial number) painted
 * out of its color, normal and ARM maps, each JPEG re-saved at its original byte
 * size so the "before" is not inflated by the edit. That is `camera-source.glb`.
 * It was then run through the publisher's Balanced preset (1024px WebP at 80,
 * Draco) on 2026-09-24, which produced this file.
 *
 * `sample-models.spec.ts` reads every figure here back from the files,
 * `sourceBytes` included, so the hero's before and after cannot drift from what
 * the sample and the served file weigh.
 */
export const HERO_MODEL = {
	url: cameraUrl,
	fileName: 'camera.glb',
	/** What the page downloads. Pinned by the spec. */
	bytes: 946_600,
	/** The same model before the Balanced preset: the camera sample. Pinned by the spec. */
	sourceBytes: 18_758_168,
	/** As `@vctrl/core` reports the served file. Pinned by the spec. */
	contents: { vertices: 17_702, materials: 4, textures: 9 },
	/** Which face the line drawing shows. */
	view: 'Front elevation'
} as const
