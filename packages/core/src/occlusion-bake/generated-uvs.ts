import {
	listTextureInfoByMaterial,
	unwrapPrimitives
} from '@gltf-transform/functions'

import {
	planOcclusionBake,
	UV_SKIP_REASONS,
	type BakeUvLayout,
	type OcclusionBakeSkipReason
} from './plan'
import { triangleIndices, type ScenePrimitive } from './scene-primitives'

import type { Document, Material } from '@gltf-transform/core'

/** The last UV set three.js reads, TEXCOORD_3: a layout past it would not draw. */
const LAST_UV_SET = 3

/**
 * The most triangles a layout is made for. Past it the parts that need one
 * are reported as too detailed rather than laid out: the time grows with the
 * mesh, and a phone would spend minutes.
 */
export const MAX_LAYOUT_TRIANGLES = 1_000_000

/** A layout planned for the bake, with the parts it lays out. */
export interface PlannedBakeUvs extends BakeUvLayout {
	/** Every part drawn by a material on the layout. */
	primitives: ScenePrimitive[]
}

/**
 * Which materials a UV set laid out for the bake would let it take: those
 * whose own UVs cannot, for a UV reason alone, and in which set. Pure, so it
 * can say so before any layout is made. Undefined when no material needs one.
 *
 * The set is the first one none of those parts carries, so nothing a material
 * reads is replaced. A material with a texture whose UV set one of its parts
 * lacks is left out: the layout would fill that set too, and the texture
 * would move. Past {@link MAX_LAYOUT_TRIANGLES}, or past the last set three.js
 * reads, every one of them says why instead.
 */
export function planBakeUvs(
	document: Document,
	{
		maxTriangles = MAX_LAYOUT_TRIANGLES,
		lastUvSet = LAST_UV_SET,
		only = () => true
	}: {
		maxTriangles?: number
		/** The last set it may lay out in. */
		lastUvSet?: number
		/** Leaves out every other material, as one no bake asked for takes. */
		only?: (material: Material) => boolean
	} = {}
): PlannedBakeUvs | undefined {
	// Both bakes' targets: a light map is baked past an occlusion texture.
	const plan = planOcclusionBake(document, { existingOcclusion: 'bake' })
	const needing = plan.skipped.filter(
		({ material, reason }) => UV_SKIP_REASONS.includes(reason) && only(material)
	)
	if (needing.length === 0) return undefined

	const materials = new Map<Material, OcclusionBakeSkipReason | undefined>()
	const drawnBy = (material: Material) =>
		plan.primitives.filter((part) => part.material === material)
	for (const { material, reason } of needing) {
		const reads = readSets(material)
		const lacksOne = drawnBy(material).some(({ primitive }) =>
			reads.some((set) => !primitive.getAttribute(`TEXCOORD_${set}`))
		)
		// Its own reason stands: the layout would fill a set its texture reads.
		materials.set(material, lacksOne ? reason : undefined)
	}

	const laidOut = [...materials].filter(([, reason]) => !reason)
	const primitives = laidOut.flatMap(([material]) => drawnBy(material))
	let texCoord = 1
	while (
		primitives.some(({ primitive }) =>
			primitive.getAttribute(`TEXCOORD_${texCoord}`)
		)
	) {
		texCoord++
	}
	const triangles = primitives.reduce(
		(sum, { primitive }) => sum + triangleIndices(primitive).length / 3,
		0
	)
	const unavailable: OcclusionBakeSkipReason | undefined =
		texCoord > lastUvSet
			? 'no-free-uv-set'
			: triangles > maxTriangles
				? 'too-detailed'
				: undefined
	if (unavailable) {
		for (const [material] of laidOut) materials.set(material, unavailable)
	}
	return {
		texCoord,
		materials,
		primitives: unavailable ? [] : primitives
	}
}

/** The planned layout, every material on it reported as `reason` instead. */
export function withoutBakeUvs(
	planned: PlannedBakeUvs,
	reason: OcclusionBakeSkipReason
): PlannedBakeUvs {
	return {
		...planned,
		materials: new Map(
			[...planned.materials].map(([material, own]) => [material, own ?? reason])
		),
		primitives: []
	}
}

/** Instances that have laid out once already. */
const laidOutWith = new WeakSet<Watlas>()

/** The structural surface of the `watlas` module glTF-Transform drives. */
export interface Watlas {
	Initialize(): Promise<void>
}

/**
 * Writes the planned layout into the document: one atlas across every part
 * on it, so one texture per bake holds them all, scaled by each part's place
 * in the scene so texels cover the surface evenly. Parts gain vertices where
 * the layout has seams; what they draw does not change.
 *
 * glTF-Transform's `unwrapPrimitives` does the work, with xatlas compiled to
 * WebAssembly as `watlas`, loaded here on first use so nothing else pays for
 * it. A watlas instance lays out the same parts the same way only once: a
 * second layout in the same instance drifts, so it lays out once per
 * instance and refuses a second: once per worker.
 */
export async function writeBakeUvs(
	planned: PlannedBakeUvs,
	watlas?: Watlas
): Promise<void> {
	if (planned.primitives.length === 0) return
	const module = watlas ?? (await import('watlas'))
	if (laidOutWith.has(module)) {
		throw new Error(
			'A watlas instance lays out only once: a second layout drifts, and a republish would change the file'
		)
	}
	laidOutWith.add(module)
	await module.Initialize()
	unwrapPrimitives(
		planned.primitives.map(({ primitive }) => primitive),
		{
			watlas: module,
			texcoord: planned.texCoord,
			overwrite: false,
			weights: planned.primitives.map(({ worldMatrix }) => scaleOf(worldMatrix))
		}
	)
}

/** The UV sets a material's textures read, its extensions' included. */
const readSets = (material: Material) => [
	...new Set(
		listTextureInfoByMaterial(material).map((info) => info.getTexCoord())
	)
]

/** The largest scale a column-major matrix applies along any axis. */
function scaleOf(m: number[]): number {
	return Math.max(
		Math.hypot(m[0], m[1], m[2]),
		Math.hypot(m[4], m[5], m[6]),
		Math.hypot(m[8], m[9], m[10])
	)
}
