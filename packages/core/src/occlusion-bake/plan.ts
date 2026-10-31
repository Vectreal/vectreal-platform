import {
	listScenePrimitives,
	triangleIndices,
	type ScenePrimitive
} from './scene-primitives'

import type { Document, Material, Primitive } from '@gltf-transform/core'
import type { Transmission } from '@gltf-transform/extensions'

/** Why a material gets no baked occlusion. */
export type OcclusionBakeSkipReason =
	/** It has an occlusion texture already, which is kept. */
	| 'existing-occlusion'
	/** One mesh is placed more than once, and each copy is occluded differently. */
	| 'shared-geometry'
	/** A skin moves it, so no one bake fits every pose. */
	| 'skinned'
	/** It has no first UV set to bake into. */
	| 'no-uv0'
	/** Its UVs repeat the texture, so one texel lands in several places. */
	| 'tiling-uvs'
	/** Two parts share texels, as mirrored halves usually do. */
	| 'overlapping-uvs'
	/**
	 * Light bake only: it is drawn from both sides, and a map lights one. The
	 * back of a lit card would draw the front's light, or its darkness.
	 */
	| 'double-sided'
	/** An animation turns, moves or reshapes it, and a bake holds one pose. */
	| 'animated'
	/**
	 * Light bake only: another part moves, or is drawn more than once, and a
	 * map cannot hold the shadow it casts here.
	 */
	| 'moving-shadows'
	/**
	 * Light bake only: a cutout whose mask the bake did not read (KTX2, an
	 * image that does not decode, too many masks) casts a shadow here, and is
	 * traced as solid, so leaves would cast rectangles.
	 */
	| 'cutout-shadows'
	/** Light bake only: it is unlit, so no light reaches it to bake. */
	| 'unlit'

/** A material that can be baked, with every primitive that draws it. */
export interface OcclusionBakeTarget {
	material: Material
	primitives: ScenePrimitive[]
}

export interface OcclusionBakePlan {
	targets: OcclusionBakeTarget[]
	skipped: { material: Material; reason: OcclusionBakeSkipReason }[]
	/** Every triangle primitive in the scene; `castsOcclusion` says which darken the others. */
	primitives: ScenePrimitive[]
}

/*
  Glass is baked like any surface but casts no occlusion: light passes through
  it, so the body behind a windscreen is not darkened by it.
*/
export function isGlass(material: Material | null): boolean {
	if (!material) return false
	const transmission = material.getExtension<Transmission>(
		'KHR_materials_transmission'
	)
	return (
		(transmission?.getTransmissionFactor() ?? 0) > 0 ||
		material.getAlphaMode() === 'BLEND'
	)
}

/*
  Whether a part darkens the others. Glass lets light through, and so does a
  cutout whose cutoff no alpha reaches: it is never drawn. A skinned,
  animated or GPU-instanced part is not always drawn where its node puts it,
  so casting from there would darken the wrong place; it casts nothing rather
  than that.
*/
export function castsOcclusion({
	node,
	material,
	animated
}: ScenePrimitive): boolean {
	return (
		!isGlass(material) &&
		!(material?.getAlphaMode() === 'MASK' && material.getAlphaCutoff() > 1) &&
		!animated &&
		!node.getSkin() &&
		!node.getExtension('EXT_mesh_gpu_instancing')
	)
}

/** How far outside the unit square a UV may sit and still count as inside. */
const UV_TOLERANCE = 0.01
/** The grid UV islands are compared on. */
const OVERLAP_GRID = 256
/** Share of covered texels that may be drawn twice before the UVs count as overlapping. */
const OVERLAP_ALLOWANCE = 0.02

/**
 * Which materials a bake into the first UV set can take, and why the others
 * cannot. `existingOcclusion: 'bake'` is for a bake that is not occlusion,
 * such as the light map, which an occlusion texture does not stand in for.
 */
export function planOcclusionBake(
	document: Document,
	{ existingOcclusion = 'keep' }: { existingOcclusion?: 'keep' | 'bake' } = {}
): OcclusionBakePlan {
	const primitives = listScenePrimitives(document)
	const placements = new Map<ScenePrimitive['mesh'], number>()
	const seenNodes = new Set<ScenePrimitive['node']>()
	for (const { node, mesh } of primitives) {
		if (seenNodes.has(node)) continue
		seenNodes.add(node)
		// A GPU-instanced node places its mesh once per instance.
		const copies = node.getExtension('EXT_mesh_gpu_instancing') ? 2 : 1
		placements.set(mesh, (placements.get(mesh) ?? 0) + copies)
	}

	const byMaterial = new Map<Material, ScenePrimitive[]>()
	for (const entry of primitives) {
		if (!entry.material) continue
		byMaterial.set(entry.material, [
			...(byMaterial.get(entry.material) ?? []),
			entry
		])
	}

	const plan: OcclusionBakePlan = { targets: [], skipped: [], primitives }
	for (const [material, drawn] of byMaterial) {
		const reason =
			existingOcclusion === 'keep' && material.getOcclusionTexture()
				? 'existing-occlusion'
				: skipReason(drawn, placements)
		if (reason) plan.skipped.push({ material, reason })
		else plan.targets.push({ material, primitives: drawn })
	}
	return plan
}

function skipReason(
	drawn: ScenePrimitive[],
	placements: Map<ScenePrimitive['mesh'], number>
): OcclusionBakeSkipReason | undefined {
	if (drawn.some(({ mesh }) => (placements.get(mesh) ?? 0) > 1)) {
		return 'shared-geometry'
	}
	if (drawn.some(({ node }) => node.getSkin())) return 'skinned'
	if (drawn.some(({ animated }) => animated)) return 'animated'
	const uvs = drawn.map(({ primitive }) => readUvs(primitive))
	if (uvs.some((uv) => !uv)) return 'no-uv0'
	if (drawn.some(({ primitive }, i) => tiles(uvs[i]!, primitive))) {
		return 'tiling-uvs'
	}
	const overlap = overlapShare(
		drawn.map(({ primitive }, i) => ({ uv: uvs[i]!, primitive }))
	)
	if (overlap > OVERLAP_ALLOWANCE) return 'overlapping-uvs'
	return undefined
}

/** TEXCOORD_0 as plain floats, decoded when the file stores them normalized. */
export function readUvs(primitive: Primitive): Float32Array | undefined {
	const accessor = primitive.getAttribute('TEXCOORD_0')
	if (!accessor) return undefined
	const count = accessor.getCount()
	const uvs = new Float32Array(count * 2)
	const element = [0, 0]
	for (let i = 0; i < count; i++) {
		accessor.getElement(i, element)
		uvs[i * 2] = element[0]
		uvs[i * 2 + 1] = element[1]
	}
	return uvs
}

/** Whether a drawn vertex sits outside the unit square; unused vertices do not count. */
function tiles(uv: Float32Array, primitive: Primitive): boolean {
	const indices = triangleIndices(primitive)
	for (let i = 0; i < indices.length; i++) {
		const u = uv[indices[i] * 2]
		const v = uv[indices[i] * 2 + 1]
		if (Math.min(u, v) < -UV_TOLERANCE || Math.max(u, v) > 1 + UV_TOLERANCE) {
			return true
		}
	}
	return false
}

/*
  Rasterizes every triangle's UVs onto a coarse grid by texel center and
  returns the share of covered texels drawn more than once. An edge two
  triangles share belongs to exactly one of them (the tie rule below), so a
  seamless island never counts against itself.
*/
function overlapShare(
	parts: { uv: Float32Array; primitive: Primitive }[]
): number {
	const N = OVERLAP_GRID
	const counts = new Uint8Array(N * N)
	for (const { uv, primitive } of parts) {
		const indices = triangleIndices(primitive)
		for (let t = 0; t + 2 < indices.length; t += 3) {
			rasterize(counts, N, uv, indices[t], indices[t + 1], indices[t + 2])
		}
	}
	let covered = 0
	let overlapped = 0
	for (const count of counts) {
		if (count > 0) covered++
		if (count > 1) overlapped++
	}
	return covered === 0 ? 0 : overlapped / covered
}

function rasterize(
	counts: Uint8Array,
	N: number,
	uv: Float32Array,
	ia: number,
	ib: number,
	ic: number
) {
	const ax = uv[ia * 2] * N
	const ay = uv[ia * 2 + 1] * N
	let bx = uv[ib * 2] * N
	let by = uv[ib * 2 + 1] * N
	let cx = uv[ic * 2] * N
	let cy = uv[ic * 2 + 1] * N
	const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
	if (area === 0) return
	// One winding for every triangle, so mirrored islands rasterize too.
	if (area < 0) {
		;[bx, by, cx, cy] = [cx, cy, bx, by]
	}

	const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)))
	const maxX = Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx)))
	const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)))
	const maxY = Math.min(N - 1, Math.ceil(Math.max(ay, by, cy)))
	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const px = x + 0.5
			const py = y + 0.5
			if (
				inside(ax, ay, bx, by, px, py) &&
				inside(bx, by, cx, cy, px, py) &&
				inside(cx, cy, ax, ay, px, py)
			) {
				const i = y * N + x
				if (counts[i] < 2) counts[i]++
			}
		}
	}
}

/*
  Left of the edge, or on it when the edge points up, or along it to the left.
  Of an edge and its reverse exactly one passes that tie rule, so a texel center
  on a shared edge goes to one triangle.
*/
function inside(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	px: number,
	py: number
): boolean {
	// Measured from the same endpoint whichever way the edge runs, so an edge
	// and its reverse give exactly opposite values and the tie rule holds.
	const forward = x0 < x1 || (x0 === x1 && y0 < y1)
	const [ox, oy, ex, ey] = forward ? [x0, y0, x1, y1] : [x1, y1, x0, y0]
	const side = (ex - ox) * (py - oy) - (ey - oy) * (px - ox)
	const w = forward ? side : -side
	const dx = x1 - x0
	const dy = y1 - y0
	return w > 0 || (w === 0 && (dy > 0 || (dy === 0 && dx < 0)))
}
