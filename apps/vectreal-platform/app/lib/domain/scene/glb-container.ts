/**
 * Splits a GLB into the glTF JSON and binary buffer a stored scene is made of.
 *
 * Only the container is read: the JSON chunk becomes `scene.gltf`, pointing
 * its binary buffer at `scene.bin`, and the BIN chunk is kept byte for byte.
 * Nothing is decoded, so Draco, meshopt, KTX2 and images embedded in buffer
 * views pass through untouched and no codec runs on the server.
 */

export const SPLIT_GLTF_FILE_NAME = 'scene.gltf'
export const SPLIT_BIN_FILE_NAME = 'scene.bin'

const GLB_MAGIC = 0x46546c67 // 'glTF'
const CHUNK_JSON = 0x4e4f534a // 'JSON'
const CHUNK_BIN = 0x004e4942 // 'BIN\0'
const HEADER_BYTES = 12
const CHUNK_HEADER_BYTES = 8

/** A file that is not a self-contained glTF 2.0 binary. */
export class GlbFormatError extends Error {
	override readonly name = 'GlbFormatError'
}

export interface SplitGlb {
	gltfJson: Uint8Array
	/** The BIN chunk as stored, or `null` for a GLB without one. */
	bin: Uint8Array | null
}

interface GltfRoot {
	asset?: { version?: unknown }
	buffers?: Array<{
		uri?: unknown
		byteLength?: unknown
		extensions?: { EXT_meshopt_compression?: { fallback?: unknown } }
	}>
	images?: Array<{ uri?: unknown }>
}

export function splitGlb(bytes: Uint8Array): SplitGlb {
	if (bytes.byteLength < HEADER_BYTES) {
		throw new GlbFormatError('The file is not a GLB: it is too short.')
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	if (view.getUint32(0, true) !== GLB_MAGIC) {
		throw new GlbFormatError('The file is not a GLB.')
	}
	if (view.getUint32(4, true) !== 2) {
		throw new GlbFormatError('Only glTF 2.0 binaries are supported.')
	}
	const declaredLength = view.getUint32(8, true)
	if (declaredLength > bytes.byteLength) {
		throw new GlbFormatError('The GLB is truncated.')
	}

	let json: GltfRoot | null = null
	let bin: Uint8Array | null = null
	let offset = HEADER_BYTES
	while (offset < declaredLength) {
		if (offset + CHUNK_HEADER_BYTES > declaredLength) {
			throw new GlbFormatError('The GLB is truncated.')
		}
		const chunkLength = view.getUint32(offset, true)
		const chunkType = view.getUint32(offset + 4, true)
		const start = offset + CHUNK_HEADER_BYTES
		const end = start + chunkLength
		if (end > declaredLength) {
			throw new GlbFormatError('The GLB is truncated.')
		}
		const data = bytes.subarray(start, end)

		if (offset === HEADER_BYTES) {
			if (chunkType !== CHUNK_JSON) {
				throw new GlbFormatError('The GLB does not start with its JSON chunk.')
			}
			json = parseJsonChunk(data)
		} else if (chunkType === CHUNK_BIN && bin === null) {
			bin = data
		}
		// Any other chunk type is ignored, as the glTF spec requires.
		offset = end
	}
	if (!json) {
		throw new GlbFormatError('The GLB has no JSON chunk.')
	}

	return { gltfJson: rewriteBuffers(json, bin), bin }
}

function parseJsonChunk(data: Uint8Array): GltfRoot {
	let parsed: unknown
	try {
		parsed = JSON.parse(new TextDecoder().decode(data))
	} catch {
		throw new GlbFormatError('The GLB has an unreadable JSON chunk.')
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new GlbFormatError('The GLB has an unreadable JSON chunk.')
	}
	const root = parsed as GltfRoot
	if (String(root.asset?.version ?? '').split('.')[0] !== '2') {
		throw new GlbFormatError('Only glTF 2.0 binaries are supported.')
	}
	return root
}

/**
 * Points the binary buffer at `scene.bin` and refuses anything outside the
 * file: a GLB names other files only if they were left behind, and the server
 * has nowhere to fetch them from.
 */
function rewriteBuffers(json: GltfRoot, bin: Uint8Array | null): Uint8Array {
	const buffers = json.buffers ?? []
	buffers.forEach((buffer, index) => {
		if (buffer.uri === undefined) {
			// A meshopt fallback buffer has no data by design: loaders that
			// decode meshopt never read it.
			if (buffer.extensions?.EXT_meshopt_compression?.fallback === true) return
			if (index !== 0 || bin === null) {
				throw new GlbFormatError('The GLB has a buffer with no data.')
			}
			buffer.uri = SPLIT_BIN_FILE_NAME
		} else if (!isDataUri(buffer.uri)) {
			throw new GlbFormatError(
				'The GLB refers to a file outside it. Pack every buffer into the GLB.'
			)
		}
	})
	for (const image of json.images ?? []) {
		if (image.uri !== undefined && !isDataUri(image.uri)) {
			throw new GlbFormatError(
				'The GLB refers to an image outside it. Pack every texture into the GLB.'
			)
		}
	}
	return new TextEncoder().encode(JSON.stringify(json))
}

function isDataUri(uri: unknown): boolean {
	return typeof uri === 'string' && uri.startsWith('data:')
}
