import decodeHeic from 'heic-decode'
import sharp from 'sharp'

import {
	MODEL_INTAKE_MAX_PHOTO_BYTES,
	MODEL_INTAKE_PHOTO_COUNT,
	type ModelIntakeFieldErrors
} from './model-intake-shared'

export interface IntakePhoto {
	bytes: Buffer
	extension: 'jpg' | 'png' | 'webp'
	contentType: 'image/jpeg' | 'image/png' | 'image/webp'
}

const OUTPUT_BY_FORMAT = {
	jpeg: { extension: 'jpg', contentType: 'image/jpeg' },
	png: { extension: 'png', contentType: 'image/png' },
	webp: { extension: 'webp', contentType: 'image/webp' }
} as const

/**
 * Turns the three uploads into the files that are stored.
 *
 * The format is read from the bytes, never from the name or the browser's
 * type, so a renamed file is refused for what it is. Every photo is
 * re-encoded: that applies the camera's orientation and drops all metadata,
 * GPS position included, which nobody asked us to keep. HEIC becomes JPEG,
 * because sharp's prebuilt libvips has no HEVC decoder and the image-to-3D
 * runtime takes only JPEG, PNG and WebP. PNG and WebP keep their format so a
 * cut-out product keeps its transparency.
 */
export async function prepareIntakePhotos(
	files: File[]
): Promise<
	| { ok: true; photos: IntakePhoto[] }
	| { ok: false; fieldErrors: ModelIntakeFieldErrors }
> {
	if (files.length !== MODEL_INTAKE_PHOTO_COUNT) {
		return { ok: false, fieldErrors: { photos: 'photosCount' } }
	}

	const photos: IntakePhoto[] = []
	for (const [index, file] of files.entries()) {
		const photoIndex = index + 1
		if (file.size > MODEL_INTAKE_MAX_PHOTO_BYTES) {
			return { ok: false, fieldErrors: { photos: 'photoSize', photoIndex } }
		}

		const photo = await encodePhoto(Buffer.from(await file.arrayBuffer()))
		if (!photo) {
			return { ok: false, fieldErrors: { photos: 'photoType', photoIndex } }
		}
		photos.push(photo)
	}

	return { ok: true, photos }
}

/**
 * The most pixels a photo may declare: 50 megapixels, just above a 48 MP
 * phone camera. Checked from the header before decoding, because the HEIC decoder
 * allocates width x height x 4 bytes up front and has no limit of its own.
 */
const MAX_PHOTO_PIXELS = 50_000_000

export function exceedsPhotoPixelLimit(width: number, height: number): boolean {
	return width * height > MAX_PHOTO_PIXELS
}

async function encodePhoto(input: Buffer): Promise<IntakePhoto | null> {
	let format: string | undefined
	let width = 0
	let height = 0
	try {
		;({ format, width = 0, height = 0 } = await sharp(input).metadata())
	} catch {
		return null
	}
	if (exceedsPhotoPixelLimit(width, height)) return null

	try {
		if (format === 'heif') {
			const decoded = await decodeHeic({ buffer: input })
			const pixels = decoded.data
			// A view on the decoder's pixels, not a second copy of them.
			const view = Buffer.from(
				pixels.buffer,
				pixels.byteOffset,
				pixels.byteLength
			)
			const bytes = await sharp(view, {
				raw: { width: decoded.width, height: decoded.height, channels: 4 }
			})
				.jpeg({ quality: 92 })
				.toBuffer()
			return { bytes, ...OUTPUT_BY_FORMAT.jpeg }
		}

		const image = sharp(input).rotate()
		if (format === 'jpeg') {
			return {
				bytes: await image.jpeg({ quality: 92 }).toBuffer(),
				...OUTPUT_BY_FORMAT.jpeg
			}
		}
		if (format === 'webp') {
			return {
				bytes: await image.webp({ quality: 92 }).toBuffer(),
				...OUTPUT_BY_FORMAT.webp
			}
		}
		if (format === 'png') {
			// No quality option: on PNG it switches sharp to a 256-colour palette.
			return { bytes: await image.png().toBuffer(), ...OUTPUT_BY_FORMAT.png }
		}
	} catch {
		// Recognized by its header and still undecodable: a broken file.
		return null
	}

	return null
}
