export type OptimizeTextureOptions = {
	resize: [number, number]
	quality: number
	targetFormat: 'webp' | 'jpeg' | 'png'
}

const DEFAULT_OPTIONS: OptimizeTextureOptions = {
	resize: [2048, 2048],
	quality: 80,
	targetFormat: 'webp'
}

export function parseOptions(optionsStr: string): OptimizeTextureOptions {
	if (!optionsStr) {
		return DEFAULT_OPTIONS
	}

	const parsed = JSON.parse(optionsStr) as Partial<OptimizeTextureOptions>
	let resize: [number, number] = DEFAULT_OPTIONS.resize
	if (Array.isArray(parsed.resize) && parsed.resize.length === 2) {
		resize = [Number(parsed.resize[0]), Number(parsed.resize[1])]
	}
	const quality =
		typeof parsed.quality === 'number'
			? parsed.quality
			: DEFAULT_OPTIONS.quality
	const targetFormat =
		parsed.targetFormat === 'jpeg' ||
		parsed.targetFormat === 'png' ||
		parsed.targetFormat === 'webp'
			? parsed.targetFormat
			: DEFAULT_OPTIONS.targetFormat

	return {
		resize,
		quality,
		targetFormat
	}
}

export function readTextureIndex(textureIndexRaw: string | undefined): number {
	const textureIndex = Number.parseInt(textureIndexRaw || '', 10)
	if (!Number.isFinite(textureIndex) || textureIndex < 0) {
		throw new Error('Invalid or missing textureIndex')
	}

	return textureIndex
}
