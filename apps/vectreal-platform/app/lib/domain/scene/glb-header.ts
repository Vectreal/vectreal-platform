const GLB_MAGIC = 0x46546c67 // 'glTF'
const JSON_CHUNK_TYPE = 0x4e4f534a // 'JSON'
const HEADER_BYTES = 12
const CHUNK_HEADER_BYTES = 8

/**
 * The extensions a GLB declares in `extensionsUsed`, read from its JSON chunk
 * without parsing anything else. Null when the bytes are not a GLB.
 *
 * Read on upload so a published model can say whether it needs the Draco
 * decoder before anyone downloads it: an embed then fetches the decoder in
 * parallel with the model, or not at all.
 */
export function readGlbExtensionsUsed(bytes: Uint8Array): string[] | null {
	if (bytes.byteLength < HEADER_BYTES + CHUNK_HEADER_BYTES) return null

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	if (view.getUint32(0, true) !== GLB_MAGIC) return null

	const chunkLength = view.getUint32(HEADER_BYTES, true)
	const chunkType = view.getUint32(HEADER_BYTES + 4, true)
	const chunkStart = HEADER_BYTES + CHUNK_HEADER_BYTES
	if (
		chunkType !== JSON_CHUNK_TYPE ||
		chunkStart + chunkLength > bytes.byteLength
	) {
		return null
	}

	try {
		const json: unknown = JSON.parse(
			new TextDecoder().decode(
				bytes.subarray(chunkStart, chunkStart + chunkLength)
			)
		)
		const used = (json as { extensionsUsed?: unknown }).extensionsUsed
		if (used === undefined) return []
		return Array.isArray(used) && used.every((name) => typeof name === 'string')
			? used
			: null
	} catch {
		return null
	}
}

export const DRACO_EXTENSION = 'KHR_draco_mesh_compression'
