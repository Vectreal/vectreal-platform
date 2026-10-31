import { bakeLights, type LightBakeOptions } from './bake-lights'
import { VectrealLightmap } from './extension'
import {
	bakeReport,
	type OcclusionBakeReport
} from '../occlusion-bake/bake-into-document'
import {
	castsOcclusion,
	planOcclusionBake,
	type OcclusionBakePlan,
	type OcclusionBakeSkipReason,
	type OcclusionBakeTarget
} from '../occlusion-bake/plan'
import { type ScenePrimitive } from '../occlusion-bake/scene-primitives'
import { encodeBakePng } from '../occlusion-bake/uv-trace'
import { bakedLightsSignature } from '../scene-lighting/baked-lights'

import type { ResolvedLighting } from '../scene-lighting/resolve-lighting'
import type { Document, Material, Node } from '@gltf-transform/core'
import type { WebGLRenderer } from 'three'

/** What a light bake did, by material name; the same shape as the occlusion report. */
export type LightBakeReport = OcclusionBakeReport

/**
 * Plans, bakes, encodes and writes the studio lights in one step: what
 * publishing runs on the copy it ships. Each baked material carries its map
 * under `VECTREAL_lightmap`. An occlusion texture already on a material does
 * not stop it, so occlusion can be baked first. Asks for a renderer only when
 * there is something to bake.
 */
export async function bakeLightsIntoDocument(
	document: Document,
	lighting: Pick<ResolvedLighting, 'lights' | 'environment'>,
	renderer: () => WebGLRenderer,
	options?: LightBakeOptions
): Promise<LightBakeReport> {
	const planned = planOcclusionBake(document, { existingOcclusion: 'bake' })
	const skipReason = lightSkipReasons(planned, animatedNodes(document))
	const plan: OcclusionBakePlan = {
		...planned,
		targets: [],
		skipped: [...planned.skipped]
	}
	for (const target of planned.targets) {
		const reason = skipReason(target)
		if (reason) plan.skipped.push({ material: target.material, reason })
		else plan.targets.push(target)
	}
	const baked =
		plan.targets.length > 0
			? await bakeLights(plan, lighting, renderer(), options)
			: []
	writeLightmaps(
		document,
		bakedLightsSignature(lighting),
		await Promise.all(
			baked.map(async (bake) => ({
				material: bake.material,
				scale: bake.scale,
				image: await encodeBakePng(bake)
			}))
		)
	)
	return bakeReport(document, baked, plan.skipped)
}

/** Every node an animation moves; their children move with them. */
function animatedNodes(document: Document): Set<Node> {
	return new Set(
		document
			.getRoot()
			.listAnimations()
			.flatMap((animation) => animation.listChannels())
			.map((channel) => channel.getTargetNode())
			.filter((node): node is Node => node !== null)
	)
}

/*
  What a light map cannot hold that occlusion can. Light depends on which way
  a surface faces, so a surface seen from both sides, or turned or reshaped by
  an animation, would carry the rest pose's light into every other. And the
  map holds every shadow on a surface in place of the live lights' own: a part
  that moves would leave its rest-pose shadow behind, and one drawn several
  times casts nothing in the bake, so while any part does either, the rest is
  left to the live lights too. So is it while a cutout casts: the bake traces
  every caster as solid. An unlit material draws no light, baked or live.
*/
function lightSkipReasons(
	plan: OcclusionBakePlan,
	moving: Set<Node>
): (target: OcclusionBakeTarget) => OcclusionBakeSkipReason | undefined {
	const moves = (node: Node | null): boolean =>
		node !== null && (moving.has(node) || moves(node.getParentNode()))
	const animated = ({ node, primitive }: ScenePrimitive) =>
		moves(node) || primitive.listTargets().length > 0
	const castsUnbakeable = plan.primitives.some(
		(part) =>
			animated(part) ||
			part.node.getSkin() !== null ||
			part.node.getExtension('EXT_mesh_gpu_instancing') !== null
	)
	const castsCutout = plan.primitives.some(
		(part) => castsOcclusion(part) && part.material?.getAlphaMode() === 'MASK'
	)
	return ({ material, primitives }) => {
		if (material.getExtension('KHR_materials_unlit')) return 'unlit'
		if (material.getDoubleSided()) return 'double-sided'
		if (primitives.some(animated)) return 'animated'
		if (castsUnbakeable) return 'moving-shadows'
		if (castsCutout) return 'cutout-shadows'
		return undefined
	}
}

/** One material's encoded light map. */
export interface LightmapImage {
	material: Material
	scale: number
	image: Uint8Array
}

/** Writes each map as a PNG under the material's `VECTREAL_lightmap`. */
export function writeLightmaps(
	document: Document,
	signature: string,
	lightmaps: LightmapImage[]
): void {
	if (lightmaps.length === 0) return
	const extension = document.createExtension(VectrealLightmap)
	for (const { material, scale, image } of lightmaps) {
		const texture = document
			.createTexture(`${material.getName() || 'material'}_lightmap`)
			.setImage(image)
			.setMimeType('image/png')
		const lightmap = extension
			.createLightmap()
			.setTexture(texture)
			.setScale(scale)
			.setSignature(signature)
		lightmap.getTextureInfo()?.setTexCoord(0)
		material.setExtension(VectrealLightmap.EXTENSION_NAME, lightmap)
	}
}
