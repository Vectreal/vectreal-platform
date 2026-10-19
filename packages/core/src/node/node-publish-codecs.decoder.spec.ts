import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

import { createNodePublishCodecs } from '.'

const { encodeToKTX2 } = vi.hoisted(() => ({
	encodeToKTX2: vi.fn(async () => new Uint8Array(1))
}))
vi.mock('ktx2-encoder', () => ({ encodeToKTX2 }))

type ImageDecoder = (bytes: Uint8Array) => Promise<{
	data: Uint8Array
	width: number
	height: number
}>

/** The decoder `encodeKtx2` hands Basis for a texture encoded at `size`. */
async function decoderFor(width: number, height: number) {
	const { encodeKtx2 } = createNodePublishCodecs()
	await encodeKtx2(
		{ image: new Uint8Array(1), mimeType: 'image/png', width, height },
		{
			isUASTC: true,
			isPerceptual: false,
			isSetKTX2SRGBTransferFunc: false,
			generateMipmap: true
		}
	)
	const [, options] = encodeToKTX2.mock.lastCall as unknown as [
		Uint8Array,
		{ imageDecoder: ImageDecoder; isUASTC: boolean }
	]
	expect(options.isUASTC).toBe(true)
	return options.imageDecoder
}

describe('the Node KTX2 encoder', () => {
	it('reads a texture as straight RGBA, resized to the size it is encoded at', async () => {
		// Nearly transparent everywhere: premultiplied, it would read back
		// almost black, which is what a 2D canvas used to ship. Two halves, so a
		// texel read from the wrong place shows.
		const left = [200, 100, 50, 10]
		const right = [20, 40, 220, 12]
		const rows = Array.from({ length: 4 }, () => [
			...Array(8).fill(left),
			...Array(8).fill(right)
		])
		const png = await sharp(Buffer.from(rows.flat(2)), {
			raw: { width: 16, height: 4, channels: 4 }
		})
			.png()
			.toBuffer()

		const decoded = await (await decoderFor(4, 2))(new Uint8Array(png))

		expect([decoded.width, decoded.height]).toEqual([4, 2])
		expect(decoded.data).toHaveLength(4 * 2 * 4)
		// The outer texels of each row, which a resize kernel still nudges by a
		// few steps. Premultiplying moves them by twenty or more, and reading at
		// the wrong size puts the left half where the right one belongs.
		const near = (x: number, y: number, expected: number[]) => {
			const at = (y * 4 + x) * 4
			expected.forEach((value, channel) =>
				expect(
					Math.abs(decoded.data[at + channel] - value)
				).toBeLessThanOrEqual(4)
			)
		}
		for (const y of [0, 1]) {
			near(0, y, left)
			near(3, y, right)
		}
	})

	it('adds an opaque alpha channel to a texture without one', async () => {
		const rgb = await sharp(Buffer.from([10, 200, 30]), {
			raw: { width: 1, height: 1, channels: 3 }
		})
			.png()
			.toBuffer()

		const decoded = await (await decoderFor(1, 1))(new Uint8Array(rgb))

		expect([...decoded.data]).toEqual([10, 200, 30, 255])
	})

	it('keeps the stored values of a texture tagged with a colour profile', async () => {
		// Written as sRGB 144, 198, 135 converted into Display P3, so the file
		// stores other numbers. The browser reads those stored numbers.
		const p3 = await sharp(Buffer.from([144, 198, 135]), {
			raw: { width: 1, height: 1, channels: 3 }
		})
			.withIccProfile('p3')
			.png()
			.toBuffer()
		const stored = await sharp(p3, { ignoreIcc: true }).raw().toBuffer()
		expect([...stored]).not.toEqual([144, 198, 135])

		const decoded = await (await decoderFor(1, 1))(new Uint8Array(p3))

		expect([...decoded.data]).toEqual([...stored, 255])
	})

	it('turns a photo upright by its EXIF orientation, as a browser does', async () => {
		// Stored 16 wide and 8 tall, red left and blue right; orientation 6
		// shows it a quarter turn clockwise, 8 wide and 16 tall, red on top.
		const red = [255, 0, 0]
		const blue = [0, 0, 255]
		const rows = Array.from({ length: 8 }, () => [
			...Array(8).fill(red),
			...Array(8).fill(blue)
		])
		const jpeg = await sharp(Buffer.from(rows.flat(2)), {
			raw: { width: 16, height: 8, channels: 3 }
		})
			.withMetadata({ orientation: 6 })
			.jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
			.toBuffer()

		const decoded = await (await decoderFor(8, 16))(new Uint8Array(jpeg))

		const texel = (x: number, y: number) => [
			...decoded.data.subarray((y * 8 + x) * 4, (y * 8 + x) * 4 + 3)
		]
		const isRed = ([r, , b]: number[]) => r > 200 && b < 60
		const isBlue = ([r, , b]: number[]) => b > 200 && r < 60
		expect(isRed(texel(4, 2))).toBe(true)
		expect(isBlue(texel(4, 13))).toBe(true)
	})
})
