declare module 'heic-decode' {
	interface DecodedImage {
		width: number
		height: number
		/** RGBA, 8 bits per channel. */
		data: Uint8ClampedArray
	}

	/** One image of the file, sized from its header and not yet decoded. */
	interface HeicImage {
		width: number
		height: number
		decode(): Promise<DecodedImage>
	}

	/** Every image in the file. `dispose` frees libheif's memory for all of them. */
	export function all(input: {
		buffer: ArrayBuffer | Uint8Array
	}): Promise<HeicImage[] & { dispose(): void }>
}
