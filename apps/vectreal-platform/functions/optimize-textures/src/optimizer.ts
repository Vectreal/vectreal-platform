import sharp from 'sharp'

import type { OptimizeTextureOptions } from './contracts'

type OptimizeResult = {
	buffer: Buffer
	mimeType: string
}

export async function optimizeTextureBuffer(params: {
	inputBuffer: Buffer
	options: OptimizeTextureOptions
}): Promise<OptimizeResult> {
	const { inputBuffer, options } = params

	let transform = sharp(inputBuffer, { animated: false })

	if (Array.isArray(options.resize) && options.resize.length === 2) {
		transform = transform.resize(options.resize[0], options.resize[1], {
			fit: 'inside',
			withoutEnlargement: true
		})
	}

	let outputMimeType: string
	switch (options.targetFormat) {
		case 'jpeg':
			transform = transform.jpeg({ quality: options.quality })
			outputMimeType = 'image/jpeg'
			break
		case 'png':
			transform = transform.png({ quality: options.quality })
			outputMimeType = 'image/png'
			break
		case 'webp':
		default:
			transform = transform.webp({ quality: options.quality })
			outputMimeType = 'image/webp'
			break
	}

	const optimizedBuffer = await transform.toBuffer()
	if (!optimizedBuffer.byteLength) {
		throw new Error('Texture optimization produced an empty output payload')
	}

	return {
		buffer: optimizedBuffer,
		mimeType: outputMimeType
	}
}
