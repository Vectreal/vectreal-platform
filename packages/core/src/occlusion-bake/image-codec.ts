/** RGBA pixels and the size they are laid out in, row 0 at the image's top. */
export interface DecodedImage {
	width: number
	height: number
	pixels: Uint8ClampedArray
}

/** Reads and writes the image types a browser or worker handles on its own. */
export interface ImageCodec {
	decode(image: Uint8Array, mimeType: string): Promise<DecodedImage>
	/** Undefined when this browser cannot write `mimeType`. */
	encode(
		pixels: Uint8ClampedArray,
		width: number,
		height: number,
		mimeType: string
	): Promise<Uint8Array | undefined>
}

export const browserImageCodec: ImageCodec = {
	async decode(image, mimeType) {
		const bitmap = await createImageBitmap(
			new Blob([image as Uint8Array<ArrayBuffer>], { type: mimeType }),
			{ premultiplyAlpha: 'none', colorSpaceConversion: 'none' }
		)
		const { width, height } = bitmap
		const context = new OffscreenCanvas(width, height).getContext('2d')
		if (!context) throw new Error('No 2D canvas context to decode an image')
		context.drawImage(bitmap, 0, 0)
		bitmap.close()
		return {
			width,
			height,
			pixels: context.getImageData(0, 0, width, height).data
		}
	},

	async encode(pixels, width, height, mimeType) {
		const canvas = new OffscreenCanvas(width, height)
		const context = canvas.getContext('2d')
		if (!context) throw new Error('No 2D canvas context to encode an image')
		context.putImageData(
			new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height),
			0,
			0
		)
		const blob = await canvas.convertToBlob({ type: mimeType })
		// A browser that cannot write the type writes PNG instead.
		if (blob.type !== mimeType) return undefined
		return new Uint8Array(await blob.arrayBuffer())
	}
}
