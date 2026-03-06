import {
	buildImageMimeLookup,
	buildSceneUploadFileDescriptor
} from './scene-upload-manifest'

import type { SerializedSceneAssetDataMap } from '@vctrl/core'


export const createFileFromDataUrl = (
	dataUrl: string,
	fileName: string
): File | null => {
	const [meta, encoded] = dataUrl.split(',')
	if (!meta || !encoded) {
		return null
	}

	const mimeMatch = meta.match(/^data:(.*?);base64$/)
	const mimeType = mimeMatch?.[1] || 'image/webp'

	try {
		const binary = atob(encoded)
		const bytes = new Uint8Array(binary.length)
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index)
		}

		return new File([bytes], fileName, { type: mimeType })
	} catch {
		return null
	}
}

export const serializeSceneAssetData = async (
	gltfData: unknown,
	gltfAssets: unknown
): Promise<SerializedSceneAssetDataMap> => {
	if (!(gltfAssets instanceof Map)) {
		return {}
	}

	const imageMimeLookup = buildImageMimeLookup(gltfData)
	const serializedEntries = await Promise.all(
		Array.from(gltfAssets.entries()).map(async ([assetId, data]) => {
			const descriptor = buildSceneUploadFileDescriptor(
				assetId,
				data,
				imageMimeLookup
			)
			const bytes = new Uint8Array(await descriptor.file.arrayBuffer())

			return [
				assetId,
				{
					data: Array.from(bytes),
					fileName: descriptor.file.name,
					mimeType: descriptor.file.type || 'application/octet-stream'
				}
			] as const
		})
	)

	return Object.fromEntries(serializedEntries)
}
