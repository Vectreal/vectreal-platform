/**
 * What a GLB declares it holds, read from its JSON chunk alone.
 *
 * The home page prints these beside whatever model is on its stage, its own or
 * a dropped one, and the spec pins the hero model's with the same function, so
 * the figure and the check cannot disagree about what is being counted.
 *
 * Reading the JSON rather than decoding the file is deliberate: the counts are
 * declared there even when the geometry is Draco-compressed, so nothing has to
 * be decompressed to state them, in the browser or in a test.
 *
 * Vertices are summed per primitive, which is how the optimizer's own report
 * counts them; a mesh with three materials is three primitives.
 */
export interface GlbContents {
	vertices: number
	materials: number
	textures: number
}

interface GltfJson {
	meshes?: { primitives: { attributes: { POSITION?: number } }[] }[]
	accessors?: { count: number }[]
	materials?: unknown[]
	textures?: unknown[]
}

const GLB_MAGIC = 0x46546c67 // 'glTF'
const JSON_CHUNK = 0x4e4f534a // 'JSON'

export function readGlbContents(buffer: ArrayBuffer): GlbContents {
	const view = new DataView(buffer)
	if (buffer.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
		throw new Error('Not a GLB file')
	}
	const chunkLength = view.getUint32(12, true)
	if (view.getUint32(16, true) !== JSON_CHUNK) {
		throw new Error('GLB has no JSON chunk')
	}
	const json: GltfJson = JSON.parse(
		new TextDecoder().decode(new Uint8Array(buffer, 20, chunkLength))
	)

	let vertices = 0
	for (const mesh of json.meshes ?? []) {
		for (const primitive of mesh.primitives) {
			const position = primitive.attributes.POSITION
			if (position !== undefined)
				vertices += json.accessors?.[position]?.count ?? 0
		}
	}

	return {
		vertices,
		materials: json.materials?.length ?? 0,
		textures: json.textures?.length ?? 0
	}
}
