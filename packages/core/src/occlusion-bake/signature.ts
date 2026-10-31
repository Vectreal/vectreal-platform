import { castsOcclusion, type OcclusionBakePlan } from './plan'

import type { OcclusionBakeOptions } from './options'

/** Raised whenever the baker's output changes for the same input. */
const OCCLUSION_BAKE_VERSION = 1

/*
  Identifies a bake by everything that changes its pixels: where every
  triangle is, its normals and UVs, which materials are baked and which cast
  no occlusion, and the options. A bake made for a preview is reused at publish
  only while this still matches.
*/
export function occlusionBakeSignature(
	plan: OcclusionBakePlan,
	options: OcclusionBakeOptions
): string {
	const hash = new Hash()
	hash.numbers([
		OCCLUSION_BAKE_VERSION,
		options.resolution,
		options.samples,
		options.distance
	])

	const targets = new Set<unknown>(plan.targets.map(({ material }) => material))
	const materialIndex = new Map<unknown, number>()
	for (const { material } of plan.primitives) {
		if (!materialIndex.has(material))
			materialIndex.set(material, materialIndex.size)
	}
	for (const entry of plan.primitives) {
		const { primitive, material, worldMatrix } = entry
		hash.numbers(worldMatrix)
		hash.numbers([
			materialIndex.get(material) ?? -1,
			targets.has(material) ? 1 : 0,
			castsOcclusion(entry) ? 1 : 0
		])
		for (const semantic of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
			hash.array(primitive.getAttribute(semantic)?.getArray())
		}
		hash.array(primitive.getIndices()?.getArray())
	}
	return hash.digest()
}

/** cyrb53: two 32-bit lanes, fast and well mixed, not cryptographic. */
class Hash {
	private h1 = 0xdeadbeef
	private h2 = 0x41c6ce57

	private byte(value: number) {
		this.h1 = Math.imul(this.h1 ^ value, 2654435761)
		this.h2 = Math.imul(this.h2 ^ value, 1597334677)
	}

	private bytes(view: Uint8Array) {
		for (let i = 0; i < view.length; i++) this.byte(view[i])
	}

	/** A typed array's bytes, after its length so neighbors cannot run together. */
	array(array: ArrayBufferView | null | undefined) {
		if (!array) {
			this.byte(0)
			return
		}
		this.numbers([array.byteLength])
		this.bytes(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))
	}

	numbers(values: ArrayLike<number>) {
		this.bytes(new Uint8Array(new Float64Array(Array.from(values)).buffer))
	}

	digest(): string {
		const { h1, h2 } = this
		const a =
			Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
			Math.imul(h2 ^ (h2 >>> 13), 3266489909)
		const b =
			Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
			Math.imul(h1 ^ (h1 >>> 13), 3266489909)
		return (
			(b >>> 0).toString(16).padStart(8, '0') +
			(a >>> 0).toString(16).padStart(8, '0')
		)
	}
}
