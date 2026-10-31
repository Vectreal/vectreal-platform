import { bakeLights, type LightBakeOptions } from './bake-lights'
import { VectrealLightmap } from './extension'
import {
	bakeReport,
	type OcclusionBakeReport
} from '../occlusion-bake/bake-into-document'
import { decodeCutoutMasks } from '../occlusion-bake/cutouts'
import {
	castsOcclusion,
	planOcclusionBake,
	type OcclusionBakePlan,
	type OcclusionBakeSkipReason,
	type OcclusionBakeTarget
} from '../occlusion-bake/plan'
import { encodeBakePng } from '../occlusion-bake/uv-trace'
import { bakedLightsSignature } from '../scene-lighting/baked-lights'

import type { ResolvedLighting } from '../scene-lighting/resolve-lighting'
import type { Document, Material } from '@gltf-transform/core'
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
	// A cutout casts solid where its mask did not decode or found no layer,
	// so the bake must know which before it plans; the trace decodes again.
	const casting = planned.primitives.filter(castsOcclusion)
	const { layerOf } = await decodeCutoutMasks(casting)
	const castsSolidCutout = casting.some(
		({ material }) =>
			material?.getAlphaMode() === 'MASK' && !layerOf.has(material)
	)
	const skipReason = lightSkipReasons(planned, castsSolidCutout)
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

/*
  What a light map cannot hold that occlusion can. Light depends on which way
  a surface faces, so a surface seen from both sides would carry one side's
  light onto the other. (The planner already skips animated parts.) And the
  map holds every shadow on a surface in place of the live lights' own: a part
  that moves would leave its rest-pose shadow behind, and one drawn several
  times casts nothing in the bake, so while any part does either, the rest is
  left to the live lights too. So is it while a cutout casts as solid, its
  mask unread: KTX2, an image that does not decode, or one past the layers
  the bake reads. An unlit material draws no light, baked or live.
*/
function lightSkipReasons(
	plan: OcclusionBakePlan,
	castsSolidCutout: boolean
): (target: OcclusionBakeTarget) => OcclusionBakeSkipReason | undefined {
	const castsUnbakeable = plan.primitives.some(
		(part) =>
			part.animated ||
			part.node.getSkin() !== null ||
			part.node.getExtension('EXT_mesh_gpu_instancing') !== null
	)
	return ({ material }) => {
		if (material.getExtension('KHR_materials_unlit')) return 'unlit'
		if (material.getDoubleSided()) return 'double-sided'
		if (castsUnbakeable) return 'moving-shadows'
		if (castsSolidCutout) return 'cutout-shadows'
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
