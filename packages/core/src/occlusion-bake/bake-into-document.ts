import { bakeOcclusion, encodeOcclusionPng } from './bake-occlusion'
import {
	planOcclusionBake,
	type OcclusionBakePlan,
	type OcclusionBakeSkipReason
} from './plan'
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
 * copy it ships. Needs a browser or worker with WebGL 2, and asks for a
 * renderer only when some material can be baked.
 */
export async function bakeOcclusionIntoDocument(
	document: Document,
	renderer: () => WebGLRenderer,
	options?: OcclusionBakeOptions
): Promise<OcclusionBakeReport> {
	const plan = planOcclusionBake(document)
	const baked =
		plan.targets.length > 0
			? await bakeOcclusion(plan, renderer(), options)
			: []
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

	return bakeReport(document, baked, plan.skipped)
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
