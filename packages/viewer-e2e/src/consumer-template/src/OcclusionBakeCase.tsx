import { Document, WebIO } from '@gltf-transform/core'
import {
	bakeOcclusion,
	encodeOcclusionPng,
	planOcclusionBake,
	writeOcclusionBake
} from '@vctrl/core/occlusion-bake'
import { useEffect } from 'react'
import { WebGLRenderer } from 'three'

const SIZE = 64

// Twelve triangles of an axis-aligned box, by corner index.
const BOX_TRIANGLES = [
	0, 1, 2, 0, 2, 3, 5, 4, 7, 5, 7, 6, 4, 0, 3, 4, 3, 7, 1, 5, 6, 1, 6, 2, 3, 2,
	6, 3, 6, 7, 4, 5, 1, 4, 1, 0
]

const boxCorners = (
	[x0, x1]: number[],
	[y0, y1]: number[],
	[z0, z1]: number[]
) =>
	[
		[x0, y0, z0],
		[x1, y0, z0],
		[x1, y1, z0],
		[x0, y1, z0],
		[x0, y0, z1],
		[x1, y0, z1],
		[x1, y1, z1],
		[x0, y1, z1]
	].flat()

/*
  A unit floor, UVs (x, z), under:
  - a box standing on it off-center, in v as well as u, so a bake read back
    upside down puts the darkness in the wrong half;
  - a thin canopy floating over another spot, covering about the cone within
    45 degrees of straight up. Only the steep half of the rays reaches it, so
    its shadow is as dark as the bake is faithful to every sample.
  Neither casting part has UVs, so they only cast. The floor carries no
  normals and the whole scene is mirrored, so the normals the baker computes
  have to survive the reversed winding.
*/
function floorScene() {
	const document = new Document()
	document.createBuffer()
	const accessor = (type: 'VEC2' | 'VEC3' | 'SCALAR', values: number[]) =>
		document
			.createAccessor()
			.setType(type)
			.setArray(
				type === 'SCALAR' ? new Uint16Array(values) : new Float32Array(values)
			)
	const caster = (name: string, corners: number[]) =>
		document
			.createPrimitive()
			.setAttribute('POSITION', accessor('VEC3', corners))
			.setIndices(accessor('SCALAR', BOX_TRIANGLES))
			.setMaterial(document.createMaterial(name))

	const floor = document
		.createPrimitive()
		.setAttribute(
			'POSITION',
			accessor('VEC3', [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1])
		)
		.setAttribute('TEXCOORD_0', accessor('VEC2', [0, 0, 1, 0, 1, 1, 0, 1]))
		.setIndices(accessor('SCALAR', [0, 2, 1, 0, 3, 2]))
		.setMaterial(document.createMaterial('floor'))

	document.createScene().addChild(
		document
			.createNode()
			.setScale([-1, 1, 1])
			.setMesh(
				document
					.createMesh()
					.addPrimitive(floor)
					.addPrimitive(
						caster('box', boxCorners([0.6, 0.8], [0, 0.2], [0.1, 0.3]))
					)
					.addPrimitive(
						caster('canopy', boxCorners([0.15, 0.35], [0.1, 0.11], [0.4, 0.6]))
					)
			)
	)
	return document
}

/** The floor's occlusion at a UV, 0 dark to 255 open. */
const texelAt = (pixels: Uint8Array, u: number, v: number) =>
	pixels[(Math.floor(v * SIZE) * SIZE + Math.floor(u * SIZE)) * 4]

async function bake() {
	const document = floorScene()
	const plan = planOcclusionBake(document)
	const renderer = new WebGLRenderer()
	try {
		const [floor] = await bakeOcclusion(plan, renderer, {
			resolution: SIZE,
			samples: 64,
			distance: 0.25
		})
		const png = await encodeOcclusionPng(floor)
		writeOcclusionBake(document, [
			{ material: floor.material, image: png, mimeType: 'image/png' }
		])
		const io = new WebIO()
		const reread = await io.readBinary(await io.writeBinary(document))
		const stored = reread
			.getRoot()
			.listMaterials()
			.find((material) => material.getName() === 'floor')

		return {
			status: 'baked' as const,
			targets: plan.targets.map(({ material }) => material.getName()),
			skipped: plan.skipped.map(
				({ material, reason }) => `${material.getName()}:${reason}`
			),
			under: texelAt(floor.pixels, 0.7, 0.2),
			beside: texelAt(floor.pixels, 0.7, 0.33),
			far: texelAt(floor.pixels, 0.95, 0.95),
			mirrored: texelAt(floor.pixels, 0.7, 0.8),
			canopy: texelAt(floor.pixels, 0.25, 0.5),
			storedPng:
				stored?.getOcclusionTexture()?.getMimeType() === 'image/png' &&
				stored.getOcclusionTexture()?.getImage()?.[1] === 0x50
		}
	} finally {
		renderer.dispose()
	}
}

export function OcclusionBakeCase() {
	useEffect(() => {
		bake().then(
			(result) => (window.__BAKE_E2E__ = result),
			(error) =>
				(window.__BAKE_E2E__ = { status: 'error', error: String(error) })
		)
	}, [])
	return <div data-testid="occlusion-bake">baking</div>
}
