import bikePreviewUrl from '../../assets/models/bike-preview.webp?url'
import bikeUrl from '../../assets/models/bike.glb?url'
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
 *   rocket-v3.glb   0.92 MB total, 0.31 MB of it textures (34%), 2 images
 *   bike.glb       12.54 MB total, 6.15 MB of it textures (49%), 50 images
 *
 * So the rocket is two thirds geometry and shows what Draco is for, and the bike
 * is half textures across fifty images and shows what WebP is for. Running the
 * wrong pass on either is the instructive half: it is how someone learns the
 * passes are not interchangeable.
 *
 * `sample-models.spec.ts` pins `bytes` against the files on disk, because a
 * figure shown in the UI beside a download is a claim.
 *
 * The URLs are Vite `?url` imports, so the bytes are fetched on click and never
 * on load. That matters for the 13 MB one.
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
		id: 'bike',
		url: bikeUrl,
		fileName: 'bike.glb',
		label: 'Bike',
		bytes: 13_145_828,
		hint: '50 textures',
		previewUrl: bikePreviewUrl
	}
]

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
