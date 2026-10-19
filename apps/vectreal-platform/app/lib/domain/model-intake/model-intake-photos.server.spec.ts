import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

import {
	exceedsPhotoPixelLimit,
	prepareIntakePhotos
} from './model-intake-photos.server'
import { MODEL_INTAKE_MAX_PHOTO_BYTES } from './model-intake-shared'

/**
 * When set, libheif reports this size for the fixture's first image, as a
 * crafted file whose header sharp reads one way and libheif another would.
 */
const libheifSize = vi.hoisted(() => ({
	current: null as null | { width: number; height: number },
	decoded: 0
}))

vi.mock('heic-decode', async (importOriginal) => {
	const actual = await importOriginal<typeof import('heic-decode')>()
	return {
		all: async (input: Parameters<typeof actual.all>[0]) => {
			const images = await actual.all(input)
			const reported = libheifSize.current
			const shown = images.map((image) => ({
				...(reported ?? { width: image.width, height: image.height }),
				decode: () => {
					libheifSize.decoded += 1
					return image.decode()
				}
			}))
			return Object.assign(shown, { dispose: () => images.dispose() })
		}
	}
})

const HEIC_FIXTURE = path.resolve(
	__dirname,
	'../../../../tests/fixtures/model-intake-photo.heic'
)

async function jpegWithGps(): Promise<Buffer> {
	return sharp({
		create: { width: 40, height: 20, channels: 3, background: '#336699' }
	})
		.jpeg()
		.withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '53/1 33/1 0/1' } })
		.toBuffer()
}

function file(bytes: Uint8Array, name: string, type = 'image/jpeg'): File {
	return new File([new Uint8Array(bytes)], name, { type })
}

describe('prepareIntakePhotos', () => {
	it('re-encodes three photos and drops their metadata', async () => {
		const jpeg = await jpegWithGps()
		expect((await sharp(jpeg).metadata()).exif).toBeDefined()

		const result = await prepareIntakePhotos([
			file(jpeg, 'a.jpg'),
			file(jpeg, 'b.jpg'),
			file(jpeg, 'c.jpg')
		])

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.photos.map((photo) => photo.extension)).toEqual([
			'jpg',
			'jpg',
			'jpg'
		])
		expect(
			(await sharp(result.photos[0].bytes).metadata()).exif
		).toBeUndefined()
	})

	it('converts an iPhone HEIC to JPEG', async () => {
		const heic = await readFile(HEIC_FIXTURE)
		const jpeg = await jpegWithGps()
		const result = await prepareIntakePhotos([
			file(heic, 'IMG_0001.HEIC', 'image/heic'),
			file(jpeg, 'b.jpg'),
			file(jpeg, 'c.jpg')
		])

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.photos[0].contentType).toBe('image/jpeg')
		expect((await sharp(result.photos[0].bytes).metadata()).format).toBe('jpeg')
	})

	it('keeps PNG so a cut-out keeps its transparency', async () => {
		const png = await sharp({
			create: {
				width: 8,
				height: 8,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 }
			}
		})
			.png()
			.toBuffer()
		const result = await prepareIntakePhotos([
			file(png, 'a.png', 'image/png'),
			file(png, 'b.png', 'image/png'),
			file(png, 'c.png', 'image/png')
		])
		expect(result.ok && result.photos[0].extension).toBe('png')
		// A PNG must keep its full colour, never be reduced to a palette.
		expect(
			result.ok && (await sharp(result.photos[0].bytes).metadata()).isPalette
		).toBe(false)
	})

	it('caps a photo at 50 megapixels, above a 48 MP phone camera', () => {
		expect(exceedsPhotoPixelLimit(8_064, 6_048)).toBe(false)
		expect(exceedsPhotoPixelLimit(8_000, 7_000)).toBe(true)
	})

	it('refuses a photo that declares no size', () => {
		expect(exceedsPhotoPixelLimit(0, 6_048)).toBe(true)
		expect(exceedsPhotoPixelLimit(8_064, 0)).toBe(true)
	})

	it('checks the size libheif will allocate, not only the one sharp read', async () => {
		const heic = await readFile(HEIC_FIXTURE)
		const jpeg = await jpegWithGps()
		libheifSize.current = { width: 20_000, height: 20_000 }
		libheifSize.decoded = 0
		try {
			const result = await prepareIntakePhotos([
				file(heic, 'IMG_0001.HEIC', 'image/heic'),
				file(jpeg, 'b.jpg'),
				file(jpeg, 'c.jpg')
			])
			expect(result).toEqual({
				ok: false,
				fieldErrors: { photos: 'photoType', photoIndex: 1 }
			})
			expect(libheifSize.decoded).toBe(0)
		} finally {
			libheifSize.current = null
		}
	})

	it('refuses anything other than exactly three photos', async () => {
		const jpeg = await jpegWithGps()
		expect(
			await prepareIntakePhotos([file(jpeg, 'a.jpg'), file(jpeg, 'b.jpg')])
		).toEqual({ ok: false, fieldErrors: { photos: 'photosCount' } })
	})

	it('names the photo that is not an image, whatever it is called', async () => {
		const jpeg = await jpegWithGps()
		const result = await prepareIntakePhotos([
			file(jpeg, 'a.jpg'),
			file(new TextEncoder().encode('%PDF-1.7 not a photo'), 'b.jpg'),
			file(jpeg, 'c.jpg')
		])
		expect(result).toEqual({
			ok: false,
			fieldErrors: { photos: 'photoType', photoIndex: 2 }
		})
	})

	it('names the photo over the size cap', async () => {
		const jpeg = await jpegWithGps()
		const big = new Uint8Array(MODEL_INTAKE_MAX_PHOTO_BYTES + 1)
		big.set(jpeg)
		const result = await prepareIntakePhotos([
			file(jpeg, 'a.jpg'),
			file(jpeg, 'b.jpg'),
			file(big, 'c.jpg')
		])
		expect(result).toEqual({
			ok: false,
			fieldErrors: { photos: 'photoSize', photoIndex: 3 }
		})
	})
})
