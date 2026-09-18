/**
 * An STL becomes a document the rest of the pipeline can carry.
 *
 * Every assertion below enters through `ModelLoader`, not through the bridge,
 * because the bridge parsing an STL is not the claim - the claim is that a file
 * a visitor drops reaches it and comes back as geometry. A test calling
 * `parseSTL` directly would prove three.js works, which nobody doubts, and is
 * the #755 shape the delivery skill records.
 *
 * Nothing here asserts "it did not throw". An empty scene is the likeliest real
 * failure for a format with no scene graph: a parser that reads zero triangles
 * returns geometry, exports a valid GLB and shows a blank stage. So the
 * assertions count vertices.
 *
 * Mutation gates, all executed and watched failing first:
 *  - `exportThreeJSGLB` returning a non-GLB buffer reddens the magic-bytes case,
 *    but it is not a gate on that case alone: `readDocument` feeds the
 *    exporter's output straight to `io.readBinary`, so all 21 bridged loads go
 *    with it and this mutation is indistinguishable from the one below;
 *  - dropping the `threeSourceBridge` branch in `readDocument` reddens every
 *    case that loads a file through a bridge: 21 of the 68 here, not all of
 *    them. The three inside the STL block that stay green ask which formats
 *    have a bridge rather than reading one, and this file has long since grown
 *    past the STL-only header it used to carry;
 *  - returning `new Mesh(geometry)` with no vertices reddens the vertex counts.
 */
import { BufferGeometry, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { IMPORTABLE_FORMAT_IDS, MODEL_FORMATS } from '../model-formats'
import { ModelLoader } from './model-loader'
import {
	BLOCKED_TEXTURE_URL,
	NON_IMAGE_SIBLING_EXTENSIONS,
	dropFailedTextures,
	imageTypeFor,
	resolveTexturesFromSiblings,
	siblingFor,
	textureSourceFor,
	THREE_SOURCE_FORMAT_IDS,
	watchTextureLoads,
	withoutMissingMaps
} from './three-source-bridges'

import type { ModelFormatId } from '../model-formats'
import type { LoadingManager } from 'three'

/**
 * `GLTFExporter` assembles the GLB through a `FileReader`, which Node does not
 * ship. That is a real constraint rather than a test problem: the bridge runs
 * in a browser or a worker, which is where every load in this product happens,
 * and `loadFromFilePath` is the one entry point it cannot serve. Recorded here
 * because it is the only reason these specs need anything of the browser at
 * all, and because a suite that silently skipped over it would leave the
 * conversion untested in the package that owns it.
 *
 * Deliberately not jsdom: a `document` makes `canLoadDracoInBrowser()` true,
 * and the decoder is then fetched through a script tag jsdom never resolves.
 */
beforeAll(() => {
	if (typeof globalThis.FileReader !== 'undefined') return

	globalThis.FileReader = class {
		result: ArrayBuffer | null = null
		onloadend: (() => void) | null = null

		readAsArrayBuffer(blob: Blob) {
			void blob.arrayBuffer().then((buffer) => {
				this.result = buffer
				this.onloadend?.()
			})
		}
	} as unknown as typeof FileReader
})

/** The 4-byte header every GLB starts with, as `readBinary` checks for it. */
const GLTF_MAGIC = [0x67, 0x6c, 0x54, 0x46]

/** One triangle, in the spelling most exporters write. */
function binarySTL(
	triangles: readonly (readonly [number, number, number])[][]
): Uint8Array {
	const bytes = new Uint8Array(84 + triangles.length * 50)
	const view = new DataView(bytes.buffer)

	// 80 bytes of header, then the face count. Left as zeros: a header that
	// begins with "solid" is the classic mis-detection, and three's loader
	// settles it on the file size rather than on those bytes.
	view.setUint32(80, triangles.length, true)

	let offset = 84
	for (const triangle of triangles) {
		for (let axis = 0; axis < 3; axis += 1) {
			view.setFloat32(offset, 0, true)
			offset += 4
		}
		for (const vertex of triangle) {
			for (const component of vertex) {
				view.setFloat32(offset, component, true)
				offset += 4
			}
		}
		// Attribute byte count, unused.
		view.setUint16(offset, 0, true)
		offset += 2
	}

	return bytes
}

const ASCII_STL = new TextEncoder().encode(
	`solid part
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
endsolid part
`
)

const BINARY_STL = binarySTL([
	[
		[0, 0, 0],
		[1, 0, 0],
		[0, 1, 0]
	]
])

/**
 * A part four times as tall as it is wide, standing in Z the way a slicer or a
 * CAD package writes one. Its shape is the assertion: whichever axis is longest
 * after conversion is the axis the pipeline treats as up.
 */
const TALL_IN_Z = binarySTL([
	[
		[0, 0, 0],
		[1, 0, 0],
		[0, 0, 4]
	],
	[
		[1, 0, 0],
		[1, 1, 4],
		[0, 0, 4]
	]
])

/** The size of the document's geometry along each axis, from the accessor. */
function extents(
	loaded: Awaited<ReturnType<ModelLoader['loadFromBuffer']>>
): [number, number, number] {
	const position = loaded.data
		.getRoot()
		.listMeshes()
		.flatMap((mesh) => mesh.listPrimitives())
		.map((primitive) => primitive.getAttribute('POSITION'))
		.find(Boolean)

	if (!position) throw new Error('the document carries no POSITION attribute')

	const min = position.getMin([]) as number[]
	const max = position.getMax([]) as number[]

	return [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
}

function positionCount(
	loader: Awaited<ReturnType<ModelLoader['loadFromBuffer']>>
) {
	return loader.data
		.getRoot()
		.listMeshes()
		.flatMap((mesh) => mesh.listPrimitives())
		.map((primitive) => primitive.getAttribute('POSITION')?.getCount() ?? 0)
}

describe('an STL loads as geometry, whichever spelling it arrives in', () => {
	/*
	  Both, because they are two parsers. An STL is binary or ASCII depending on
	  what wrote it, slicers and scanners disagree, and the visitor cannot tell
	  which one they are holding.
	*/
	it.each([
		['binary', BINARY_STL],
		['ASCII', ASCII_STL]
	])('reads a %s STL into a mesh with vertices', async (_spelling, bytes) => {
		const result = await new ModelLoader().loadFromBuffer(bytes, 'part.stl')

		expect(result.type).toBe('stl')

		const counts = positionCount(result)
		expect(counts.length, 'the document carries no mesh').toBeGreaterThan(0)
		for (const count of counts) {
			expect(count, 'a mesh arrived with no vertices').toBeGreaterThanOrEqual(3)
		}
	})

	it('hands back the GLB it converted the STL into', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			BINARY_STL,
			'part.stl'
		)

		expect(result.glbBytes).toBeDefined()
		expect([...result.glbBytes!.slice(0, 4)]).toEqual(GLTF_MAGIC)
	})

	it('converts nothing for a file that is already GLB', async () => {
		/*
		  A real GLB, made by the conversion above rather than by a fixture, so
		  this cannot pass against bytes no reader would accept. The claim is that
		  the glTF family is not re-serialized: its own bytes are what the caller
		  should hand the optimizer, and a round trip through the exporter would
		  quietly drop whatever it arrived compressed as.
		*/
		const loader = new ModelLoader()
		const converted = await loader.loadFromBuffer(BINARY_STL, 'part.stl')

		const reloaded = await loader.loadFromBuffer(
			converted.glbBytes!,
			'part.glb'
		)

		expect(reloaded.type).toBe('glb')
		expect(reloaded.glbBytes).toBeUndefined()
		expect(positionCount(reloaded)[0]).toBeGreaterThanOrEqual(3)
	})

	/*
	  glTF mandates Y-up and STL declares nothing, so the converter has to choose
	  - and the choice is not cosmetic. Without it the exported GLB is wrong by
	  the spec, and a part lies on its side in our viewer, in model-viewer, in
	  Blender and in Quick Look alike. It reads to a visitor as the drag
	  controls being inverted, because a model whose own up axis points at the
	  camera tumbles rather than turns.
	*/
	it('stands a Z-up part up, because glTF is Y-up', async () => {
		const result = await new ModelLoader().loadFromBuffer(TALL_IN_Z, 'part.stl')
		const [x, y, z] = extents(result)

		expect(y, `the tall axis came out as ${[x, y, z]}`).toBeGreaterThan(x)
		expect(y, `the tall axis came out as ${[x, y, z]}`).toBeGreaterThan(z)
		// The 4:1 proportion survives, so this cannot pass on a squashed model.
		expect(y / Math.max(x, z)).toBeCloseTo(4, 5)
	})

	it('has a bridge only for formats the loader accepts', async () => {
		// A bridge for a format `MODEL_FORMATS` does not import is dead code: the
		// file is refused by `formatFor` before any parser is reached.
		for (const id of THREE_SOURCE_FORMAT_IDS) {
			expect(
				IMPORTABLE_FORMAT_IDS as readonly string[],
				`${id} has a three.js bridge but is not importable`
			).toContain(id)
		}
		expect(THREE_SOURCE_FORMAT_IDS.length).toBeGreaterThan(0)
	})

	/*
	  The other direction, and the one that fires when a format is added. Until
	  this existed, a new importable row with no bridge compiled, shipped, and
	  prerendered three converter pages for a file `io.readBinary` cannot read -
	  every one of them failing on the first drop, with nothing red anywhere.
	*/
	it('has a bridge for every format nothing else can read', () => {
		/*
		  The exemptions, each for its own reason. `gltf` and `glb` are what
		  glTF-Transform reads natively, so a bridge would be a round trip for
		  nothing. `usdz` is not a design decision but a known defect: its bytes
		  are a zip and they are handed to a glTF reader, which is tracked on its
		  own row. It sits here so that this test states the exception instead of
		  quietly covering it.
		*/
		const READ_WITHOUT_A_BRIDGE: readonly ModelFormatId[] = [
			'gltf',
			'glb',
			'usdz'
		]

		for (const id of IMPORTABLE_FORMAT_IDS) {
			if (READ_WITHOUT_A_BRIDGE.includes(id)) continue

			expect(
				THREE_SOURCE_FORMAT_IDS,
				`${id} is importable and no parser in this package can read it`
			).toContain(id)
		}
	})

	it('refuses a format with no reader behind it', async () => {
		// The owner decides this, not the bridge: `.step` is in no row, so the
		// file never reaches a loader at all.
		await expect(
			new ModelLoader().loadFromBuffer(BINARY_STL, 'part.step')
		).rejects.toThrow(/Unsupported file type: part\.step/)
	})
})

/* ---------------------------------------------------------------------------
   FBX fixtures.

   Written here rather than committed as binary files, for the reason the STL
   builder above exists: a fixture whose bytes nobody can read is a fixture
   nobody can change, and the interesting cases are all one field apart. Both
   spellings are built because they are two separate parsers inside
   `FBXLoader` - a converter that reads only one of them is useless, since the
   visitor cannot tell which one their file is.
--------------------------------------------------------------------------- */

interface FbxScene {
	/** `GlobalSettings.UpAxis`. 2 is Z-up, which is what the tools emit. */
	upAxis?: number
	/** `GlobalSettings.UnitScaleFactor`: centimetres one unit represents. */
	unitScaleFactor?: number
	/**
	 * Hangs the mesh under one top-level `Null`, the way Maya, 3ds Max and
	 * Blender all export by default. `FBXLoader` collapses a scene whose root
	 * has a single `Group` child and returns that child instead, which is what
	 * separates the object carrying the file's settings from the object handed
	 * back.
	 */
	rootNull?: boolean
	vertices: readonly number[]
	/** FBX polygon indices: the last vertex of a face is written ~i. */
	polygons: readonly number[]
}

/** A part four times as tall as it is wide, standing in Z the way CAD writes one. */
const WEDGE: FbxScene = {
	upAxis: 2,
	unitScaleFactor: 1,
	vertices: [0, 0, 0, 1, 0, 0, 0, 0, 4, 1, 0, 0, 1, 1, 4, 0, 0, 4],
	polygons: [0, 1, -3, 3, 4, -6]
}

function asciiFBX(scene: FbxScene): Uint8Array {
	const settings = [
		scene.upAxis === undefined
			? ''
			: `\t\tP: "UpAxis", "int", "Integer", "",${scene.upAxis}`,
		scene.unitScaleFactor === undefined
			? ''
			: `\t\tP: "UnitScaleFactor", "double", "Number", "",${scene.unitScaleFactor}`
	]
		.filter(Boolean)
		.join('\n')

	return new TextEncoder().encode(`; FBX 7.4.0 project file
FBXHeaderExtension:  {
	FBXHeaderVersion: 1003
	FBXVersion: 7400
}
GlobalSettings:  {
	Version: 1000
	Properties70:  {
${settings}
	}
}
Objects:  {
	Geometry: 1001, "Geometry::part", "Mesh" {
		Vertices: *${scene.vertices.length} {
			a: ${scene.vertices.join(',')}
		}
		PolygonVertexIndex: *${scene.polygons.length} {
			a: ${scene.polygons.join(',')}
		}
		GeometryVersion: 124
	}
	Model: 2001, "Model::part", "Mesh" {
		Version: 232
	}
${
	scene.rootNull
		? `	Model: 3001, "Model::root", "Null" {
		Version: 232
	}`
		: ''
}
}
Connections:  {
${
	scene.rootNull
		? `	C: "OO",3001,0
	C: "OO",2001,3001`
		: `	C: "OO",2001,0`
}
	C: "OO",1001,2001
}
`)
}

/*
  A binary FBX 7400, in the node-record shape `BinaryParser` reads: a 27-byte
  header, then records carrying their own end offset, then a 13-byte null record
  closing each nested list.
*/
function binaryFBX(scene: FbxScene): Uint8Array {
	/*
	  Refused rather than ignored. Only the ASCII builder emits the root `Null`,
	  so accepting the flag here would hand back a scene with no single-group
	  root - and a collapse test written against it would pass without ever
	  reaching the collapse, which is the one thing it exists to exercise.
	*/
	if (scene.rootNull) {
		throw new Error('binaryFBX does not build a root Null; use asciiFBX.')
	}

	const text = new TextEncoder()
	const bytes = (...parts: Uint8Array[]) => {
		const total = parts.reduce((sum, part) => sum + part.length, 0)
		const out = new Uint8Array(total)
		let at = 0
		for (const part of parts) {
			out.set(part, at)
			at += part.length
		}
		return out
	}
	const scalar = (write: (view: DataView) => void, size: number) => {
		const out = new Uint8Array(size)
		write(new DataView(out.buffer))
		return out
	}
	const u8 = (n: number) => scalar((v) => v.setUint8(0, n), 1)
	const u32 = (n: number) => scalar((v) => v.setUint32(0, n, true), 4)
	const i32 = (n: number) => scalar((v) => v.setInt32(0, n, true), 4)
	const f64 = (n: number) => scalar((v) => v.setFloat64(0, n, true), 8)

	const prop = {
		int: (v: number) => bytes(text.encode('I'), i32(v)),
		double: (v: number) => bytes(text.encode('D'), f64(v)),
		string: (v: number | string) => {
			const encoded = text.encode(String(v))
			return bytes(text.encode('S'), u32(encoded.length), encoded)
		},
		/* Arrays carry length, encoding (0 = uncompressed) and byte length. */
		doubles: (vs: readonly number[]) =>
			bytes(
				text.encode('d'),
				u32(vs.length),
				u32(0),
				u32(vs.length * 8),
				...vs.map(f64)
			),
		ints: (vs: readonly number[]) =>
			bytes(
				text.encode('i'),
				u32(vs.length),
				u32(0),
				u32(vs.length * 4),
				...vs.map(i32)
			)
	}

	const NULL_RECORD = new Uint8Array(13)

	type Record_ = (start: number) => Uint8Array
	const record =
		(
			name: string,
			props: Uint8Array[] = [],
			children: Record_[] = []
		): Record_ =>
		(start) => {
			const label = text.encode(name)
			const propList = bytes(...props)
			let end = start + 13 + label.length + propList.length
			const nested: Uint8Array[] = []
			for (const child of children) {
				const built = child(end)
				nested.push(built)
				end += built.length
			}
			if (children.length > 0) end += NULL_RECORD.length
			return bytes(
				u32(end),
				u32(props.length),
				u32(propList.length),
				u8(label.length),
				label,
				propList,
				...nested,
				...(children.length > 0 ? [NULL_RECORD] : [])
			)
		}

	const settings: Record_[] = [record('Version', [prop.int(1000)])]
	const properties: Record_[] = []
	if (scene.upAxis !== undefined) {
		properties.push(
			record('P', [
				prop.string('UpAxis'),
				prop.string('int'),
				prop.string('Integer'),
				prop.string(''),
				prop.int(scene.upAxis)
			])
		)
	}
	if (scene.unitScaleFactor !== undefined) {
		properties.push(
			record('P', [
				prop.string('UnitScaleFactor'),
				prop.string('double'),
				prop.string('Number'),
				prop.string(''),
				prop.double(scene.unitScaleFactor)
			])
		)
	}
	if (properties.length > 0)
		settings.push(record('Properties70', [], properties))

	const top: Record_[] = [
		record('FBXHeaderExtension', [], [record('FBXVersion', [prop.int(7400)])]),
		record('GlobalSettings', [], settings),
		record(
			'Objects',
			[],
			[
				record(
					'Geometry',
					[prop.int(1001), prop.string('Geometry::part'), prop.string('Mesh')],
					[
						record('Vertices', [prop.doubles(scene.vertices)]),
						record('PolygonVertexIndex', [prop.ints(scene.polygons)]),
						record('GeometryVersion', [prop.int(124)])
					]
				),
				record(
					'Model',
					[prop.int(2001), prop.string('Model::part'), prop.string('Mesh')],
					[record('Version', [prop.int(232)])]
				)
			]
		),
		record(
			'Connections',
			[],
			[
				record('C', [prop.string('OO'), prop.int(2001), prop.int(0)]),
				record('C', [prop.string('OO'), prop.int(1001), prop.int(2001)])
			]
		)
	]

	const header = bytes(
		text.encode('Kaydara FBX Binary  '),
		new Uint8Array([0x00, 0x1a, 0x00]),
		u32(7400)
	)

	let offset = header.length
	const built: Uint8Array[] = []
	for (const node of top) {
		const buffer = node(offset)
		built.push(buffer)
		offset += buffer.length
	}

	/*
	  The footer every exporter writes. It is not decoration: `endOfContent`
	  stops parsing 176 bytes from the end of the file, so without it the last
	  top-level record - `Connections` - is never read, and the loader dies
	  resolving a geometry that is connected to nothing.
	*/
	return bytes(...[header, ...built, NULL_RECORD, new Uint8Array(176)])
}

/**
 * The document's geometry in scene space, as the corners of its bounding box.
 *
 * Deliberately not the accessor bounds `extents` reads. An STL is rotated in
 * its vertex data, so local and world agree; an FBX is not - `FBXLoader` puts
 * its up-axis correction and this bridge puts its unit scale on the root node's
 * transform, which is where a scene graph belongs. Reading the accessor alone
 * would report a part that is upside down or a hundred times too large as
 * perfect, which is the whole of what these cases are about.
 */
function worldBounds(
	loaded: Awaited<ReturnType<ModelLoader['loadFromBuffer']>>
): { min: number[]; max: number[] } {
	const min = [Infinity, Infinity, Infinity]
	const max = [-Infinity, -Infinity, -Infinity]

	for (const node of loaded.data.getRoot().listNodes()) {
		const mesh = node.getMesh()
		if (!mesh) continue

		const matrix = node.getWorldMatrix()

		for (const primitive of mesh.listPrimitives()) {
			const position = primitive.getAttribute('POSITION')
			if (!position) continue

			const low = position.getMin([]) as number[]
			const high = position.getMax([]) as number[]

			/* Every corner, because a rotation moves each one differently. */
			for (let corner = 0; corner < 8; corner += 1) {
				const point = [
					corner & 1 ? high[0] : low[0],
					corner & 2 ? high[1] : low[1],
					corner & 4 ? high[2] : low[2]
				]

				for (let axis = 0; axis < 3; axis += 1) {
					const value =
						matrix[axis] * point[0] +
						matrix[axis + 4] * point[1] +
						matrix[axis + 8] * point[2] +
						matrix[axis + 12]
					min[axis] = Math.min(min[axis], value)
					max[axis] = Math.max(max[axis], value)
				}
			}
		}
	}

	return { min, max }
}

describe('an FBX loads as a scene, whichever spelling it arrives in', () => {
	it.each([
		['binary', binaryFBX],
		['ASCII', asciiFBX]
	])('reads a %s FBX into a mesh with vertices', async (_spelling, build) => {
		const result = await new ModelLoader().loadFromBuffer(
			build(WEDGE),
			'part.fbx'
		)

		expect(result.type).toBe('fbx')

		const counts = positionCount(result)
		expect(counts.length, 'the document carries no mesh').toBeGreaterThan(0)
		for (const count of counts) {
			expect(count, 'a mesh arrived with no vertices').toBeGreaterThanOrEqual(3)
		}
	})

	it('hands back the GLB it converted the FBX into', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			binaryFBX(WEDGE),
			'part.fbx'
		)

		expect(result.glbBytes).toBeDefined()
		expect([...result.glbBytes!.slice(0, 4)]).toEqual(GLTF_MAGIC)
	})

	/*
	  An FBX says which way is up, unlike an STL, and `FBXLoader` already acts on
	  it. This asserts the correction survives the export rather than that we
	  apply one - adding our own would turn a Z-up part upside down, which is a
	  second rotation the size alone cannot see. Hence the floor as well as the
	  height.
	*/
	it('stands a Z-up part up without turning it over', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			binaryFBX(WEDGE),
			'part.fbx'
		)
		const { min, max } = worldBounds(result)
		const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]

		expect(size[1], `the part came out ${size}`).toBeGreaterThan(size[0])
		expect(size[1], `the part came out ${size}`).toBeGreaterThan(size[2])
		expect(size[1] / Math.max(size[0], size[2])).toBeCloseTo(4, 5)
		/* It stands on the floor. Rotate it once more and this goes to -0.04. */
		expect(min[1]).toBeCloseTo(0, 5)
	})

	/*
	  glTF's unit is the metre and FBX's is whatever the file says. Maya and 3ds
	  Max both write centimetres, so the common file is a hundred times the size
	  it means - invisible in our viewer, which frames whatever it is handed, and
	  very visible in AR Quick Look, which does not.
	*/
	it('converts a part measured in centimetres to metres', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			binaryFBX(WEDGE),
			'part.fbx'
		)

		/* 4 units at 1 cm each. Without the scale this reads 4, in metres. */
		expect(worldBounds(result).max[1]).toBeCloseTo(0.04, 6)

		/*
		  And the file no longer claims the unit it was measured in. `userData`
		  is exported as `extras`, so a leftover factor here is a GLB telling its
		  next reader to divide by a hundred again.
		*/
		for (const node of result.data.getRoot().listNodes()) {
			expect(node.getExtras()).not.toHaveProperty('unitScaleFactor')
		}
	})

	it('applies the unit of a file whose models hang under one root', async () => {
		/*
		  The shape Maya, 3ds Max and Blender all export by default, and the one
		  that lost its unit. `FBXLoader` writes the file's settings onto the
		  scene root it builds and *then* replaces that root with its only child,
		  so reading the factor off the object it returns finds nothing and a
		  centimetre file arrives a hundred times too large - invisible in a
		  viewer that frames whatever it is given, and a building-sized chair in
		  AR Quick Look.
		*/
		const result = await new ModelLoader().loadFromBuffer(
			asciiFBX({ ...WEDGE, rootNull: true, unitScaleFactor: 1 }),
			'part.fbx'
		)

		expect(worldBounds(result).max[1]).toBeCloseTo(0.04, 6)
	})

	it('leaves a part already measured in metres alone', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			binaryFBX({ ...WEDGE, unitScaleFactor: 100 }),
			'part.fbx'
		)

		expect(worldBounds(result).max[1]).toBeCloseTo(4, 6)
	})

	it('leaves a part that declares no unit alone', async () => {
		/*
		  Nothing is known about that file, and centimetres is only the FBX
		  default rather than a promise - guessing it would shrink a correct
		  model by a hundred.
		*/
		const result = await new ModelLoader().loadFromBuffer(
			binaryFBX({ ...WEDGE, unitScaleFactor: undefined }),
			'part.fbx'
		)

		expect(worldBounds(result).max[1]).toBeCloseTo(4, 6)
	})
})

/*
  The wait that stands between a textured file and a GLB full of blank images.
  Driven through a `LoadingManager` directly because the branch that matters -
  a file that starts no loads at all - cannot be produced by a fixture: every
  texture path in three needs a DOM to make an `img` with, and these specs
  deliberately run without one.
*/
describe('waiting for textures settles in both directions', () => {
	it('resolves immediately when the parse loaded nothing', async () => {
		const { LoadingManager } = await import('three')
		const manager = new LoadingManager()

		const settled = watchTextureLoads(manager)

		/* Nothing calls `itemStart`, so `onLoad` will never fire. */
		await expect(settled()).resolves.toBeUndefined()
	})

	it('waits for a load that has started, and for every one after it', async () => {
		const { LoadingManager } = await import('three')
		const manager = new LoadingManager()

		const settled = watchTextureLoads(manager)
		manager.itemStart('wood.png')
		manager.itemStart('metal.png')

		const order: string[] = []
		const wait = settled().then(() => order.push('settled'))

		manager.itemEnd('wood.png')
		await Promise.resolve()
		expect(order, 'settled while a texture was still loading').toEqual([])

		manager.itemEnd('metal.png')
		await wait
		expect(order).toEqual(['settled'])
	})

	it('settles when a texture fails rather than hanging on it', async () => {
		const { LoadingManager } = await import('three')
		const manager = new LoadingManager()

		const settled = watchTextureLoads(manager)
		manager.itemStart('missing.png')

		/* What `ImageLoader` does on error: report it, then end the item. */
		manager.itemError('missing.png')
		manager.itemEnd('missing.png')

		await expect(settled()).resolves.toBeUndefined()
	})
})

/* ---------------------------------------------------------------------------
   OBJ, and the siblings it cannot be read without.
--------------------------------------------------------------------------- */

const encode = (text: string) => new TextEncoder().encode(text)

/** A triangle four units tall in Y, which is the axis OBJ is usually written in. */
const OBJ = encode(`# a part
mtllib part.mtl
o part
v 0 0 0
v 1 0 0
v 0 4 0
usemtl painted
f 1 2 3
`)

/** Orange-ish, so the channels are ordered and a default white cannot pass. */
const MTL = encode(`newmtl painted
Kd 0.800 0.400 0.100
`)

/** The same library, referring to an image the visitor did not bring. */
const MTL_WITH_TEXTURE = encode(`newmtl painted
Kd 0.800 0.400 0.100
map_Kd checker.png
`)

function baseColor(
	loaded: Awaited<ReturnType<ModelLoader['loadFromBuffer']>>
): number[] {
	const materials = loaded.data.getRoot().listMaterials()
	expect(materials.length, 'the document carries no material').toBeGreaterThan(
		0
	)
	return [...materials[0].getBaseColorFactor()]
}

describe('an OBJ loads with the material library beside it', () => {
	it('reads the mesh', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			OBJ,
			'part.obj',
			new Map([['part.mtl', MTL]])
		)

		expect(result.type).toBe('obj')

		const counts = positionCount(result)
		expect(counts.length, 'the document carries no mesh').toBeGreaterThan(0)
		for (const count of counts) {
			expect(count, 'a mesh arrived with no vertices').toBeGreaterThanOrEqual(3)
		}
	})

	/*
	  The assertion the whole bundle machinery exists for. `OBJLoader.parse` never
	  reads the `.mtl` itself - it records the name and moves on - so without the
	  sibling reaching the bridge this comes back default white, which looks like
	  a working conversion and is not one.
	*/
	it('colours the mesh from the material library', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			OBJ,
			'part.obj',
			new Map([['part.mtl', MTL]])
		)

		const [red, green, blue] = baseColor(result)

		expect([red, green, blue], 'the material came back untouched').not.toEqual([
			1, 1, 1
		])
		/* Ordered as `Kd` writes them, so a wrong channel order cannot pass. */
		expect(red).toBeGreaterThan(green)
		expect(green).toBeGreaterThan(blue)
	})

	it('takes the material library whatever the folder renamed it to', async () => {
		/*
		  The OBJ names `part.mtl`; this one arrives as `materials.mtl`. Matching
		  on the written name would refuse a folder somebody tidied after export,
		  which is ordinary rather than exotic - so every `.mtl` in the selection
		  is read.
		*/
		const result = await new ModelLoader().loadFromBuffer(
			OBJ,
			'part.obj',
			new Map([['materials.mtl', MTL]])
		)

		expect(baseColor(result)[0]).toBeGreaterThan(baseColor(result)[2])
	})

	it('loads without a material library rather than refusing', async () => {
		/*
		  A visitor who drops only the `.obj` gets the mesh, not an error. The
		  page says to bring the `.mtl`; a model on screen with no colour is a
		  readable outcome, and nothing else in this pipeline can show them that
		  their file was fine.
		*/
		const result = await new ModelLoader().loadFromBuffer(OBJ, 'part.obj')

		expect(positionCount(result)[0]).toBeGreaterThanOrEqual(3)
	})

	/*
	  No rotation, unlike STL. An OBJ declares no axis and its writers disagree,
	  so the only defensible move is to change nothing - and this is what goes red
	  if somebody copies the STL fix across, which is the likelier mistake now
	  that two of the three bridged formats correct an axis.
	*/
	it('leaves the axes exactly as the file wrote them', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			OBJ,
			'part.obj',
			new Map([['part.mtl', MTL]])
		)

		const { min, max } = worldBounds(result)
		const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]

		expect(size[1], `the part came out ${size}`).toBeCloseTo(4, 5)
		expect(min[1], 'the part was moved off the floor').toBeCloseTo(0, 5)
	})

	it('hands back the GLB it converted the OBJ into', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			OBJ,
			'part.obj',
			new Map([['part.mtl', MTL]])
		)

		expect(result.glbBytes).toBeDefined()
		expect([...result.glbBytes!.slice(0, 4)]).toEqual(GLTF_MAGIC)
	})
})

/*
  How a texture reference finds the file that arrived with it. Driven directly
  for the reason `watchTextureLoads` is: every path that reaches it needs an
  `img`, and these specs run without a DOM.
*/
describe('a texture reference finds the file beside the model', () => {
	const WOOD = new Uint8Array([1, 2, 3])
	const METAL = new Uint8Array([4, 5, 6])
	const siblings = new Map([
		['wood.png', WOOD],
		['textures/metal.png', METAL]
	])

	it('matches the name an MTL writes', () => {
		expect(siblingFor(siblings, 'wood.png')).toBe(WOOD)
	})

	it('matches whatever case the reference is written in', () => {
		expect(siblingFor(siblings, 'WOOD.PNG')).toBe(WOOD)
	})

	it('matches a Windows path against a folder key', () => {
		/*
		  An MTL exported on Windows writes `textures\\metal.png`, and a folder
		  dropped anywhere keys it as `textures/metal.png`. Without this the
		  texture silently does not load and the model comes back grey.
		*/
		/*
		  `toBe`, not `toBeDefined`. Answering every reference with the first
		  sibling satisfied the old assertion while handing back `wood.png` for a
		  `metal.png` reference - "something came back" is the exact class of
		  defect this module exists to prevent.
		*/
		expect(siblingFor(siblings, 'textures\\metal.png')).toBe(METAL)
	})

	it('matches a nested reference by its file name alone', () => {
		/* The MTL says one folder, the drop flattened it into another. */
		expect(siblingFor(siblings, '../maps/wood.png')).toBe(WOOD)
	})

	it('finds nothing for a file that did not arrive', () => {
		expect(siblingFor(siblings, 'missing.png')).toBeUndefined()
	})

	it('refuses to choose between two files with the same name', () => {
		/*
		  An ordinary export: one image name reused per part, each in its own
		  folder. Answering with either one textures a material with the wrong
		  image and reports success, so the reference resolves to nothing and
		  the map is dropped - the "correct but grey" the page already promises.
		*/
		expect(siblingFor(AMBIGUOUS, 'diffuse.png')).toBeUndefined()
	})

	it('still resolves each of those by the folder it names', () => {
		/* Ambiguity is a property of the reference, not of the selection. */
		expect(siblingFor(AMBIGUOUS, 'wheels/diffuse.png')).toEqual(
			new Uint8Array([2])
		)
	})

	it('does not let one name be satisfied by another ending in it', () => {
		expect(siblingFor(siblings, 'ood.png')).toBeUndefined()
	})

	it('prefers the nearest match when a name repeats deeper down', () => {
		/*
		  A selection is keyed from whatever was dropped, so a reference is
		  relative to some folder inside it. `textures/wood.png` has exactly one
		  meaning here - naming the other file would take saying `lod1/` - and
		  calling that ambiguous dropped a texture that resolves perfectly well.
		*/
		const withLods = new Map([
			['chair/textures/wood.png', new Uint8Array([1])],
			['chair/lod1/textures/wood.png', new Uint8Array([2])]
		])

		expect(siblingFor(withLods, 'textures/wood.png')).toEqual(
			new Uint8Array([1])
		)
	})

	it('does not scope to the top level when only the model name is known', () => {
		/*
		  `loadFromBuffer` has nothing but a file name to pass, and a loose file
		  dragged in beside a folder has no path either. A bare name has a root
		  of `''`, and scoping to that admits only keys with no folder at all -
		  hiding every nested sibling, which is strictly worse than not scoping.
		*/
		const nested = new Map([['textures/metal.png', new Uint8Array([7])]])

		expect(siblingFor(nested, 'metal.png', 'part.obj')).toEqual(
			new Uint8Array([7])
		)
	})

	it('finds nothing for a reference that climbs out of the selection', () => {
		/*
		  Clamping the climb at the root and walking back down resolved this to
		  another dropped folder's file. Refusing that is path arithmetic; the
		  cross-folder guard is separate, and `dropped-selection.spec.ts` owns the
		  climb that lands squarely on a sibling drop rather than past it.
		*/
		const twoFolders = new Map([
			['chaira/lod0/chair.obj', new Uint8Array([0])],
			['chairb/textures/wood.png', new Uint8Array([2])]
		])

		expect(
			siblingFor(
				twoFolders,
				'../../../chairb/textures/wood.png',
				'chaira/lod0/chair.obj'
			)
		).toBeUndefined()
	})

	it('still refuses when two matches are equally near', () => {
		/* The real ambiguity: neither folder is the one the reference means. */
		const twoParts = new Map([
			['car/body/diffuse.png', new Uint8Array([1])],
			['car/wheels/diffuse.png', new Uint8Array([2])]
		])

		expect(siblingFor(twoParts, 'diffuse.png')).toBeUndefined()
	})

	it('resolves a reference against the folder the model sits in', () => {
		/*
		  The stage that can be certain, and the reason the model's own path is
		  passed in at all. Both files below are a `textures/wood.png` under the
		  one dropped folder, so the looser stages rank them by depth and pick
		  the *shallower* - which is the wrong one. Only reading the reference as
		  relative to the model resolves it.
		*/
		const lods = new Map([
			['chair/lod1/chair.obj', new Uint8Array([0])],
			['chair/lod1/textures/wood.png', new Uint8Array([1])],
			['chair/textures/wood.png', new Uint8Array([2])]
		])

		expect(
			siblingFor(lods, 'textures/wood.png', 'chair/lod1/chair.obj')
		).toEqual(new Uint8Array([1]))
	})

	it('reads a reference that climbs out of the model folder', () => {
		/*
		  The decoy at the top is what makes this about the climb. `..` means one
		  folder up from the model, which here is *deeper* than a same-named file
		  at the root - so treating the climb as nothing and falling back to the
		  nearest match answers with the decoy.
		*/
		const bundle = new Map([
			['bundle/a/b/chair.obj', new Uint8Array([0])],
			['bundle/a/wood.png', new Uint8Array([1])],
			['bundle/wood.png', new Uint8Array([2])]
		])

		expect(siblingFor(bundle, '../wood.png', 'bundle/a/b/chair.obj')).toEqual(
			new Uint8Array([1])
		)
	})

	it('ignores files belonging to another folder dropped alongside', () => {
		/*
		  Two folders arrive in one gesture and the loader picks one model, so
		  the other folder's files sit in the same map. The reference here does
		  not match the layout - an ordinary tidied export - so it reaches the
		  tail stage, where ranking a stranger's file against this model's by
		  depth alone made them tie and the texture vanish. Worse, a shallower
		  stranger would have won outright.
		*/
		const twoFolders = new Map([
			['chaira/lod0/chair.obj', new Uint8Array([0])],
			['chaira/textures/wood.png', new Uint8Array([1])],
			['chairb/textures/wood.png', new Uint8Array([2])]
		])

		expect(
			siblingFor(twoFolders, 'textures/wood.png', 'chaira/lod0/chair.obj')
		).toEqual(new Uint8Array([1]))
	})

	it('does not answer an ambiguous reference with a vaguer rule', () => {
		/*
		  A tie in the path stage used to read as "found nothing", so the walk
		  carried on to the name-only stage and answered with a file that is in
		  neither folder the reference could have meant.
		*/
		const tied = new Map([
			['bundle/chair.obj', new Uint8Array([0])],
			['bundle/cara/textures/diffuse.png', new Uint8Array([1])],
			['bundle/carb/textures/diffuse.png', new Uint8Array([2])],
			['bundle/diffuse.png', new Uint8Array([3])]
		])

		expect(
			siblingFor(tied, 'textures/diffuse.png', 'bundle/chair.obj')
		).toBeUndefined()
	})

	it('matches a reference relative to a folder above the model', () => {
		/*
		  The selection is keyed from whatever was dropped, which may be a
		  folder above the one the MTL writes its paths against.
		*/
		const nested = new Map([['chair/textures/metal.png', new Uint8Array([7])]])

		expect(siblingFor(nested, 'textures/metal.png')).toEqual(
			new Uint8Array([7])
		)
	})
})

/** One image name reused per part, each in its own folder. */
const AMBIGUOUS = new Map([
	['body/diffuse.png', new Uint8Array([1])],
	['wheels/diffuse.png', new Uint8Array([2])]
])

/*
  The case that hung. An OBJ's MTL names a texture, the visitor drops only the
  `.obj` and the `.mtl`, and the reference resolves to nothing we hold. Letting
  it through meant three asked the site for `/checker.png`; against a server
  that answers every unknown path with the app shell the image neither loaded
  nor errored, the wait for it never finished, and the page sat on "loading"
  with no way out. Found by running it, not by reading it.
*/
describe('a texture that did not arrive is not fetched from anywhere', () => {
	it('loads an OBJ whose material names an image that is missing', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			OBJ,
			'part.obj',
			new Map([['part.mtl', MTL_WITH_TEXTURE]])
		)

		expect(positionCount(result)[0]).toBeGreaterThanOrEqual(3)
	})

	it('keeps the material colour instead of a texture it could not load', async () => {
		const result = await new ModelLoader().loadFromBuffer(
			OBJ,
			'part.obj',
			new Map([['part.mtl', MTL_WITH_TEXTURE]])
		)

		/* What the page promises: correct, and grey rather than broken. */
		expect(result.data.getRoot().listTextures()).toHaveLength(0)

		const [red, green, blue] = baseColor(result)
		expect(red).toBeGreaterThan(green)
		expect(green).toBeGreaterThan(blue)
	})

	describe('the material library drops only what is missing', () => {
		const siblings = new Map([['wood.png', new Uint8Array([1])]])

		it('keeps a map whose file arrived', () => {
			expect(withoutMissingMaps('map_Kd wood.png', siblings)).toBe(
				'map_Kd wood.png'
			)
		})

		it('keeps a map written with options before the file name', () => {
			/*
			  `map_Kd -s 1 1 1 wood.png` is legal: the options come first, and
			  the file name is whatever is left once the ones MTLLoader knows
			  are taken off.
			*/
			expect(
				withoutMissingMaps('map_Kd -s 1 1 1 wood.png', siblings)
			).toContain('wood.png')
		})

		it('keeps a map whose file name contains a space', () => {
			/*
			  MTLLoader strips the options it knows by name and rejoins what is
			  left with spaces, so it resolves this line. Reading the file name
			  as the last field instead deletes a map whose image did arrive.
			*/
			const spaced = new Map([['wood grain.png', new Uint8Array([1])]])

			expect(withoutMissingMaps('map_Kd wood grain.png', spaced)).toBe(
				'map_Kd wood grain.png'
			)
			expect(withoutMissingMaps('map_Kd -s 1 1 1 wood grain.png', spaced)).toBe(
				'map_Kd -s 1 1 1 wood grain.png'
			)
		})

		it('drops a map whose file did not', () => {
			expect(withoutMissingMaps('map_Kd missing.png', siblings)).toBe('')
		})

		it('drops a normal map whose file did not arrive', () => {
			/*
			  `norm` is the one map statement not spelled `map_*`, and MTLLoader
			  reads it as the normal map - so leaving it out of the keywords let
			  the line through and built exactly the blocked texture this filter
			  exists to prevent.
			*/
			expect(withoutMissingMaps('norm missing.png', siblings)).toBe('')
		})

		it('drops the other statements that name a file', () => {
			/* `bump` and `refl` take a file name without the `map_` prefix. */
			expect(withoutMissingMaps('bump missing.png', siblings)).toBe('')
			expect(withoutMissingMaps('refl missing.png', siblings)).toBe('')
		})

		it('leaves everything that is not a file reference alone', () => {
			const library = 'newmtl painted\nKd 0.8 0.4 0.1\nNs 40.0'
			expect(withoutMissingMaps(library, siblings)).toBe(library)
		})
	})

	describe('every texture reference resolves locally or not at all', () => {
		const siblings = new Map([['wood.png', new Uint8Array([1, 2, 3])]])

		it('reads a file that arrived', () => {
			const source = textureSourceFor(siblings, 'wood.png')

			expect(source.kind).toBe('bytes')
			expect(source).toMatchObject({ type: 'image/png' })
		})

		it('passes an image the loader already inlined straight through', () => {
			/* An FBX's embedded images arrive as blob URLs it made itself. */
			expect(textureSourceFor(siblings, 'blob:http://x/y').kind).toBe('inline')
			expect(textureSourceFor(siblings, 'data:image/png;base64,AA').kind).toBe(
				'inline'
			)
		})

		it('refuses a name it does not hold rather than resolving it', () => {
			expect(textureSourceFor(siblings, 'missing.png').kind).toBe('blocked')
		})

		it('never fetches an absolute URL a file asked for', () => {
			/*
			  An MTL or an FBX may name a texture on somebody's server. Fetching
			  it would make a converter that runs entirely in the browser reach
			  out to a third party on the strength of a dropped file, so the
			  outcome is either bytes we already hold or nothing - never the URL.
			*/
			const held = textureSourceFor(siblings, 'https://example.com/wood.png')
			const notHeld = textureSourceFor(siblings, 'https://example.com/gone.png')

			/* A file of that name arrived, so theirs is used instead. */
			expect(held.kind).toBe('bytes')

			/*
			  Exhaustively, not `kind !== 'inline'`: the two lines above already
			  pin the kind, so a loop asserting the kind is not `inline` could
			  never be the assertion that failed. What it cannot see is a variant
			  that keeps the kind and smuggles the address through beside it.
			*/
			expect(notHeld).toEqual({ kind: 'blocked' })
		})
	})

	it('points an unresolvable reference at nothing that can be requested', () => {
		/*
		  The invariant behind all of the above, stated where it can be checked:
		  whatever the modifier hands back for a file we do not hold, it must not
		  be something a browser would go and ask for.

		  One assertion, because the scheme decides it. This also carried
		  `not.toMatch(/^https?:|^\/\/|^\//)`, which a `data:` URL satisfies by
		  construction - so it could only ever fail in company, after the line
		  above had already failed.
		*/
		expect(BLOCKED_TEXTURE_URL.startsWith('data:')).toBe(true)
	})
})

/*
  The rule an FBX cannot state in its own bytes. `withoutMissingMaps` edits an
  OBJ's material library before anything parses it; an FBX's materials are
  binary records, so the same rule has to be applied to the parsed scene.
*/
describe('a material does not keep a texture that failed to load', () => {
	const material = () => new MeshStandardMaterial()

	function meshWith(map: unknown): Mesh {
		const mesh = new Mesh(new BufferGeometry(), material())
		;(mesh.material as unknown as Record<string, unknown>)['map'] = map
		return mesh
	}

	it('takes off a map whose image never became anything', () => {
		/*
		  What an FBX naming an image the visitor did not bring leaves behind.
		  `GLTFExporter` draws `texture.image` onto a canvas, so a zero-sized
		  image is not a blank texture - it is a canvas of no size, and the
		  whole conversion fails on a file that was only missing a picture.
		*/
		const mesh = meshWith({ isTexture: true, image: { width: 0, height: 0 } })

		dropFailedTextures(mesh)

		expect((mesh.material as MeshStandardMaterial).map).toBeNull()
	})

	it('takes off a map that has no image at all', () => {
		const mesh = meshWith({ isTexture: true, image: null })

		dropFailedTextures(mesh)

		expect((mesh.material as MeshStandardMaterial).map).toBeNull()
	})

	it('leaves a map whose image loaded', () => {
		const loaded = { isTexture: true, image: { width: 8, height: 8 } }
		const mesh = meshWith(loaded)

		dropFailedTextures(mesh)

		expect((mesh.material as MeshStandardMaterial).map).toBe(loaded)
	})

	it('leaves a source it cannot judge alone', () => {
		/* A data or compressed texture reports no `width` on its image. */
		const opaque = { isTexture: true, image: {} }
		const mesh = meshWith(opaque)

		dropFailedTextures(mesh)

		expect((mesh.material as MeshStandardMaterial).map).toBe(opaque)
	})

	it('reaches a material through the scene graph, not just the root', () => {
		const root = new Object3D()
		const mesh = meshWith({ isTexture: true, image: { width: 0 } })
		root.add(mesh)

		dropFailedTextures(root)

		expect((mesh.material as MeshStandardMaterial).map).toBeNull()
	})
})

/*
  Who owns a texture URL. Driven through the manager directly, because the only
  thing that calls the modifier is a loader asking for an image.
*/
describe('every texture URL a conversion uses is released with it', () => {
	function withStubbedObjectUrls(run: (revoked: string[]) => void): void {
		const revoked: string[] = []
		const made: string[] = []
		const original = {
			create: URL.createObjectURL,
			revoke: URL.revokeObjectURL
		}

		URL.createObjectURL = () => {
			const url = `blob:made/${made.length}`
			made.push(url)
			return url
		}
		URL.revokeObjectURL = (url: string) => void revoked.push(url)

		try {
			run(revoked)
		} finally {
			URL.createObjectURL = original.create
			URL.revokeObjectURL = original.revoke
		}
	}

	/** Only `setURLModifier` is used, so a bare object is the whole manager. */
	function fakeManager(): {
		modify: (url: string) => string
		setURLModifier: (fn: (url: string) => string) => void
	} {
		let modifier = (url: string) => url
		return {
			modify: (url) => modifier(url),
			setURLModifier: (fn) => void (modifier = fn)
		}
	}

	it('releases a blob URL it made for a sibling', () => {
		withStubbedObjectUrls((revoked) => {
			const manager = fakeManager()
			const release = resolveTexturesFromSiblings(
				manager as unknown as LoadingManager,
				new Map([['wood.png', new Uint8Array([1])]])
			)

			const used = manager.modify('wood.png')
			release()

			expect(revoked).toEqual([used])
		})
	})

	it('releases a blob URL the loader made for an embedded image', () => {
		/*
		  `FBXLoader` creates one of these per embedded image and revokes none
		  of them, and an FBX carrying its textures inside itself is the common
		  case - so releasing only our own held every image for the life of the
		  tab, on a page whose whole purpose is that you try another file.
		*/
		withStubbedObjectUrls((revoked) => {
			const manager = fakeManager()
			const release = resolveTexturesFromSiblings(
				manager as unknown as LoadingManager,
				new Map()
			)

			expect(manager.modify('blob:three/embedded-1')).toBe(
				'blob:three/embedded-1'
			)
			release()

			expect(revoked).toEqual(['blob:three/embedded-1'])
		})
	})

	it('has nothing to release for a data URL', () => {
		withStubbedObjectUrls((revoked) => {
			const manager = fakeManager()
			const release = resolveTexturesFromSiblings(
				manager as unknown as LoadingManager,
				new Map()
			)

			manager.modify('data:image/png;base64,AA')
			release()

			expect(revoked).toEqual([])
		})
	})
})

/*
  The two places that know which images we accept.
*/
describe('every image the picker offers can actually be decoded', () => {
	/*
	  Written out, and asserted as an exact mapping. Deriving the expected side
	  from the same constants the production code reads would pass for any
	  contents of them - and a loop whose only guard is a skip-list can be
	  emptied by widening that list, leaving a green test with no assertions at
	  all.
	*/
	const EXPECTED_IMAGE_TYPES: Readonly<Record<string, string>> = {
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		webp: 'image/webp'
	}

	const declared = new Set(
		MODEL_FORMATS.flatMap((format) => format.siblingExtensions)
	)

	it('classifies every sibling extension the owner declares', () => {
		/*
		  Exactly one of the two, so an extension cannot be quietly moved out of
		  the image set to silence the assertion below.
		*/
		for (const extension of declared) {
			const isImage = extension in EXPECTED_IMAGE_TYPES
			const isData = NON_IMAGE_SIBLING_EXTENSIONS.includes(extension)

			expect(
				isImage !== isData,
				`the owner offers .${extension} and nothing here says what it is`
			).toBe(true)
		}
	})

	it('gives each of those images its own media type', () => {
		/*
		  The exact type, not merely something beginning `image/`: mapping png to
		  `image/jpeg` decodes nothing and a prefix check cannot see it.
		*/
		for (const [extension, type] of Object.entries(EXPECTED_IMAGE_TYPES)) {
			if (!declared.has(extension)) continue

			expect(imageTypeFor(`texture.${extension}`)).toBe(type)
		}
	})

	it('covers the images the owner actually declares, so neither rule is vacuous', () => {
		const images = [...declared].filter(
			(extension) => !NON_IMAGE_SIBLING_EXTENSIONS.includes(extension)
		)

		expect(images.sort()).toEqual(['jpeg', 'jpg', 'png', 'webp'])
	})

	it('names something other than an image as one it cannot decode', () => {
		expect(imageTypeFor('scene.bin')).toBe('application/octet-stream')
	})
})
