import { bakeLights, type LightBakeOptions } from './bake-lights'
import { VectrealLightmap } from './extension'
import {
	bakeReport,
	encodeOnce,
	type OcclusionBakeReport
} from '../occlusion-bake/bake-into-document'
import { decodeCutoutMasks } from '../occlusion-bake/cutouts'
import {
	planBakeUvs,
	type PlannedBakeUvs
} from '../occlusion-bake/generated-uvs'
import {
	castsOcclusion,
	planOcclusionBake,
	type BakeUvLayout,
	type OcclusionBakePlan,
	type OcclusionBakeSkipReason,
	type OcclusionBakeTarget
} from '../occlusion-bake/plan'
import { encodeBakePng } from '../occlusion-bake/uv-trace'
import { bakedLightsSignature } from '../scene-lighting/baked-lights'

import type { ResolvedLighting } from '../scene-lighting/resolve-lighting'
import type { Document, Material, Texture } from '@gltf-transform/core'
import type { WebGLRenderer } from 'three'

/** What a light bake did, by material name; the same shape as the occlusion report. */
export type LightBakeReport = OcclusionBakeReport

/**
 * Plans, bakes, encodes and writes the studio lights in one step: what
 * publishing runs on the copy it ships. Each baked material carries its map
 * under `VECTREAL_lightmap`. An occlusion texture already on a material does
 * not stop it, so occlusion can be baked first. Asks for a renderer only when
 * there is something to bake. `layout` is as `bakeOcclusionIntoDocument`
 * takes it.
 */
export async function bakeLightsIntoDocument(
	document: Document,
	lighting: Pick<ResolvedLighting, 'lights' | 'environment'>,
	renderer: () => WebGLRenderer,
	options?: LightBakeOptions,
	onProgress?: (fraction: number) => void,
	layout?: BakeUvLayout
): Promise<LightBakeReport> {
	const plan = await planLightBake(document, layout)
	const baked =
		plan.targets.length > 0
			? await bakeLights(plan, lighting, renderer(), options, onProgress)
			: []
	const encode = encodeOnce(encodeBakePng)
	writeLightmaps(
		document,
		bakedLightsSignature(lighting),
		await Promise.all(
			baked.map(async (bake) => ({
				material: bake.material,
				scale: bake.scale,
				image: await encode(bake),
				texCoord: bake.texCoord
			}))
		)
	)
	return bakeReport(document, baked, plan.skipped)
}

/**
 * Which materials the light bake can take, and why the others cannot: the
 * occlusion planner's answer, less what a light map cannot hold. Needs no
 * GPU, so it can say before a bake whether one would draw anything. Async
 * because it decodes the cutout masks. `layout` is as `planOcclusionBake`
 * takes it.
 */
export async function planLightBake(
	document: Document,
	layout?: BakeUvLayout
): Promise<OcclusionBakePlan> {
	const planned = planOcclusionBake(document, {
		existingOcclusion: 'bake',
		layout
	})
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
	return plan
}

/**
 * The UV set to lay out for the bakes asked for: only for the materials one
 * of them would take on it, so no part is laid out, made heavier or counted
 * against the triangle budget for a bake that skips it anyway. Planned, not
 * made: `writeBakeUvs` makes it. Undefined when no material asked for needs
 * one.
 */
export async function planBakeUvsFor(
	document: Document,
	{ occlusion, lights }: { occlusion: boolean; lights: boolean }
): Promise<PlannedBakeUvs | undefined> {
	// Every material a layout could take, before its limits apply to the
	// ones the bakes take: only those count against them.
	const every = planBakeUvs(document, {
		maxTriangles: Infinity,
		lastUvSet: Infinity
	})
	if (!every) return undefined
	const taken = new Set<Material>()
	if (occlusion) {
		for (const { material } of planOcclusionBake(document, { layout: every })
			.targets) {
			taken.add(material)
		}
	}
	if (lights) {
		for (const { material } of (await planLightBake(document, every)).targets) {
			taken.add(material)
		}
	}
	return planBakeUvs(document, { only: (material) => taken.has(material) })
}

/*
  What a light map cannot hold that occlusion can. (The planner already skips
  animated parts.) A double-sided surface is baked from its authored normal,
  as occlusion is, and its back shows the front's light: models are mostly
  open shells drawn double-sided, nearly all with that normal facing out, so
  skipping them would leave most models no baked light at all. The
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
		if (castsUnbakeable) return 'moving-shadows'
		if (castsSolidCutout) return 'cutout-shadows'
		return undefined
	}
}

/**
 * One material's encoded light map, and the UV set it was baked in (0 when
 * absent). Materials on one layout made for the bake pass the same `image`,
 * which is written once.
 */
export interface LightmapImage {
	material: Material
	scale: number
	image: Uint8Array
	texCoord?: number
}

/** Writes each map as a PNG under the material's `VECTREAL_lightmap`. */
export function writeLightmaps(
	document: Document,
	signature: string,
	lightmaps: LightmapImage[]
): void {
	if (lightmaps.length === 0) return
	const extension = document.createExtension(VectrealLightmap)
	const written = new Map<Uint8Array, Texture>()
	for (const { material, scale, image, texCoord = 0 } of lightmaps) {
		let texture = written.get(image)
		if (!texture) {
			const name = `${texCoord === 0 ? material.getName() || 'material' : 'studio'}_lightmap`
			texture = document
				.createTexture(name)
				.setImage(image)
				.setMimeType('image/png')
			written.set(image, texture)
		}
		const lightmap = extension
			.createLightmap()
			.setTexture(texture)
			.setScale(scale)
			.setSignature(signature)
		lightmap.getTextureInfo()?.setTexCoord(texCoord)
		material.setExtension(VectrealLightmap.EXTENSION_NAME, lightmap)
	}
}
