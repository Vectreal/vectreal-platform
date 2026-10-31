import { bakeOcclusion, encodeOcclusionPng } from './bake-occlusion'
import { planOcclusionBake, type OcclusionBakeSkipReason } from './plan'
import { writeOcclusionBake } from './write-occlusion'

import type { OcclusionBakeOptions } from './options'
import type { Document, Material } from '@gltf-transform/core'
import type { WebGLRenderer } from 'three'

/** What a bake did, by material name, plain enough to post from a worker. */
export interface OcclusionBakeReport {
	baked: string[]
	skipped: { material: string; reason: OcclusionBakeSkipReason }[]
}

/**
 * Plans, bakes, encodes and writes in one step: what publishing runs on the
 * copy it ships. Needs a browser or worker with WebGL 2.
 */
export async function bakeOcclusionIntoDocument(
	document: Document,
	renderer: WebGLRenderer,
	options?: OcclusionBakeOptions
): Promise<OcclusionBakeReport> {
	const plan = planOcclusionBake(document)
	const baked = await bakeOcclusion(plan, renderer, options)
	writeOcclusionBake(
		document,
		await Promise.all(
			baked.map(async (bake) => ({
				material: bake.material,
				image: await encodeOcclusionPng(bake),
				mimeType: 'image/png' as const
			}))
		)
	)

	const materials = document.getRoot().listMaterials()
	const label = (material: Material) =>
		material.getName() || `material ${materials.indexOf(material) + 1}`
	return {
		baked: baked.map(({ material }) => label(material)),
		skipped: plan.skipped.map(({ material, reason }) => ({
			material: label(material),
			reason
		}))
	}
}
