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
	/*
	  THE WHOLE URI, NOT ITS LAST SEGMENT. A stored asset used to be named by its
	  basename while the saved glTF kept the folder URIs it was written with, so
	  `body/diffuse.png` and `wheels/diffuse.png` became one stored `diffuse.png`
	  and both URIs resolved to it on reload: a chair whose wheels wore the
	  body's texture, saved, reported as success, and reproducible forever after.
	  That is the same defect the dropped-selection rule was written to end, one
	  frame over, and keeping the folder is what closes it.

	  Nothing downstream needs this flattened. The storage object path strips the
	  separators itself (`asset-object-path.ts`), and a scene saved before this
	  still loads: its assets keep their flat names and the loader's name-only
	  rung answers a foldered URI with them, which is the rule that frame has
	  always relied on.
	*/
	const storedFileName = normalizedName
	const mimeFromDocument = imageMimeLookup
		? Array.from(buildAssetLookupKeys(normalizedName)).reduce<
				string | undefined
			>(
				(foundMimeType, key) => foundMimeType ?? imageMimeLookup.get(key),
				undefined
			)
		: undefined
	const mimeFromBytes = normalizedBytes
		? detectMimeTypeFromBytes(normalizedBytes)
		: null
	const mimeFromFileName = resolveMimeTypeFromFileName(fileName)
	const mimeType =
		mimeFromBytes ??
		(mimeFromFileName !== 'application/octet-stream'
			? mimeFromFileName
			: mimeFromDocument) ??
		mimeFromFileName
	const kind =
		getAssetKindFromMimeType(mimeType) === 'image' ? 'image' : 'buffer'
	const fileData: BlobPart = normalizedBytes ?? (data as BlobPart)

	return {
		file: new File([fileData], storedFileName, { type: mimeType }),
		fileName: storedFileName,
		kind,
		mimeType
	}
}
