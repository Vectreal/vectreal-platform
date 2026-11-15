import { dropUnusedWebpExtension } from '../webp-extension'
import { bakeOcclusion, encodeOcclusionPng } from './bake-occlusion'
import { packOcclusionIntoMetallicRoughness } from './pack-occlusion'
import {
	planOcclusionBake,
	type BakeUvLayout,
	type OcclusionBakePlan,
	type OcclusionBakeSkipReason
} from './plan'
import { writeOcclusionBake, type BakedOcclusionImage } from './write-occlusion'

import type { OcclusionBakeOptions } from './options'
import type { UvBake } from './uv-trace'
import type { Document, Material } from '@gltf-transform/core'
import type { WebGLRenderer } from 'three'

/** What a bake did, by material name, plain enough to post from a worker. */
export interface OcclusionBakeReport {
	baked: string[]
	skipped: { material: string; reason: OcclusionBakeSkipReason }[]
}

/**
 * Plans, bakes, encodes and writes in one step: what publishing runs on the
 * copy it ships. Needs a browser or worker with WebGL 2, and asks for a
 * renderer only when some material can be baked. `layout`, a UV set laid out
 * for the bake and already written (`planBakeUvs`, `writeBakeUvs`), takes the
 * materials whose own UVs cannot.
 */
export async function bakeOcclusionIntoDocument(
	document: Document,
	renderer: () => WebGLRenderer,
	options?: OcclusionBakeOptions,
	onProgress?: (fraction: number) => void,
	layout?: BakeUvLayout
): Promise<OcclusionBakeReport> {
	const plan = planOcclusionBake(document, { layout })
	const baked =
		plan.targets.length > 0
			? await bakeOcclusion(plan, renderer(), options, onProgress)
			: []
	const encode = encodeOnce(encodeOcclusionPng)
	const images = await Promise.all(baked.map(encode))
	const separate: BakedOcclusionImage[] = []
	// One at a time: each holds a decoded metallic-roughness image.
	for (const [i, bake] of baked.entries()) {
		const image = images[i]
		if (await packOcclusionIntoMetallicRoughness(bake, image)) continue
		separate.push({
			material: bake.material,
			image,
			mimeType: 'image/png',
			texCoord: bake.texCoord
		})
	}
	writeOcclusionBake(document, separate)
	// A packed WebP texture is a PNG now.
	dropUnusedWebpExtension(document)

	return bakeReport(document, baked, plan.skipped)
}

/**
 * An encoder that encodes each map once: materials on one layout share their
 * bake's pixels, and so their image.
 */
export function encodeOnce(
	encode: (bake: UvBake) => Promise<Uint8Array>
): (bake: UvBake) => Promise<Uint8Array> {
	const encoded = new Map<Uint8Array, Promise<Uint8Array>>()
	return (bake) => {
		let image = encoded.get(bake.pixels)
		if (!image) encoded.set(bake.pixels, (image = encode(bake)))
		return image
	}
}

/** A bake's outcome by material name, the unnamed numbered as the file lists them. */
export function bakeReport(
	document: Document,
	baked: { material: Material }[],
	skipped: OcclusionBakePlan['skipped']
): OcclusionBakeReport {
	const materials = document.getRoot().listMaterials()
	const label = (material: Material) =>
		material.getName() || `material ${materials.indexOf(material) + 1}`
	return {
		baked: baked.map(({ material }) => label(material)),
		skipped: skipped.map(({ material, reason }) => ({
			material: label(material),
			reason
		}))
	}
}
