import {
	buildAssetLookupKeys,
	detectMimeTypeFromBytes,
	getAssetKindFromMimeType,
	normalizeAssetUri,
	resolveMimeTypeFromFileName
} from '@vctrl/core'

export type SceneUploadAssetKind = 'buffer' | 'image'

export interface SceneUploadFileDescriptor {
	file: File
	fileName: string
	kind: SceneUploadAssetKind
	mimeType: string
}

const toUint8Array = (value: unknown): Uint8Array | null => {
	if (value instanceof Uint8Array) {
		return value
	}

	if (value instanceof ArrayBuffer) {
		return new Uint8Array(value)
	}

	if (ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
	}

	return null
}

export const buildImageMimeLookup = (
	gltfData: unknown
): Map<string, string> => {
	const lookup = new Map<string, string>()

	if (!gltfData || typeof gltfData !== 'object') {
		return lookup
	}

	const images = (gltfData as { images?: unknown }).images
	if (!Array.isArray(images)) {
		return lookup
	}

	for (const image of images) {
		if (!image || typeof image !== 'object') {
			continue
		}

		const uri = (image as { uri?: unknown }).uri
		const mimeType = (image as { mimeType?: unknown }).mimeType
		if (typeof uri !== 'string' || typeof mimeType !== 'string') {
			continue
		}

		const normalizedUri = normalizeAssetUri(uri)
		for (const key of buildAssetLookupKeys(normalizedUri)) {
			lookup.set(key, mimeType)
		}
	}

	return lookup
}

export const buildSceneUploadFileDescriptor = (
	fileName: string,
	data: unknown,
	imageMimeLookup?: Map<string, string>
): SceneUploadFileDescriptor => {
	const bytes = toUint8Array(data)
	const normalizedBytes = bytes ? new Uint8Array(bytes) : null
	const normalizedName = normalizeAssetUri(fileName)
	const basename = normalizedName.split('/').pop() || normalizedName
	const mimeFromDocument = imageMimeLookup
		? (imageMimeLookup.get(normalizedName) ?? imageMimeLookup.get(basename))
		: undefined
	const mimeFromBytes = normalizedBytes
		? detectMimeTypeFromBytes(normalizedBytes)
		: null
	const mimeType =
		mimeFromDocument ?? mimeFromBytes ?? resolveMimeTypeFromFileName(fileName)
	const kind =
		getAssetKindFromMimeType(mimeType) === 'image' ? 'image' : 'buffer'
	const fileData: BlobPart = normalizedBytes ?? (data as BlobPart)

	return {
		file: new File([fileData], fileName, { type: mimeType }),
		fileName,
		kind,
		mimeType
	}
}
