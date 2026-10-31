import {
	BAKED_LIGHTMAP_USER_DATA,
	bakedLightsSignature,
	type BakedLightmapInfo,
	type ResolvedLighting
} from '@vctrl/core'
import {
	ShaderChunk,
	type IUniform,
	type Material,
	type MeshStandardMaterial,
	type Object3D,
	type WebGLProgramParametersWithUniforms
} from 'three'

/*
  The two lines of three's lighting a baked map replaces, matched exactly: a
  three upgrade that rewrites either fails `baked-lights.spec.ts` rather than
  leaving the live lights doubled on top of the map.
*/
const LIVE_DIRECT_DIFFUSE =
	'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );'
const THREE_LIGHTMAP =
	/#ifdef USE_LIGHTMAP\s+vec4 lightMapTexel[\s\S]*?irradiance \+= lightMapIrradiance;\s+#endif/

/**
 * The material's lighting with the map in place of the live lights' diffuse
 * light: the map joins direct diffuse light after `aomap_fragment`, so the
 * occlusion, which dims only indirect light, does not darken the bake's own
 * shadows twice; three's own light-map term, which would add it as indirect
 * light, is removed; and the live lights' diffuse light is scaled by
 * `1 - bakedLightsOn`, so turning the map off brings them back without a
 * recompile. Their highlights stay live either way.
 */
export function patchBakedLightsShader(
	shader: Pick<
		WebGLProgramParametersWithUniforms,
		'fragmentShader' | 'uniforms'
	>,
	on: IUniform<number>
): void {
	shader.uniforms['bakedLightsOn'] = on
	shader.fragmentShader =
		`uniform float bakedLightsOn;\n${shader.fragmentShader}`
			.replace(
				'#include <lights_physical_pars_fragment>',
				ShaderChunk.lights_physical_pars_fragment.replace(
					LIVE_DIRECT_DIFFUSE,
					LIVE_DIRECT_DIFFUSE.replace('+=', '+= ( 1.0 - bakedLightsOn ) *')
				)
			)
			.replace(
				'#include <lights_fragment_maps>',
				ShaderChunk.lights_fragment_maps.replace(THREE_LIGHTMAP, '')
			)
			.replace(
				'#include <aomap_fragment>',
				/* glsl */ `#include <aomap_fragment>
#ifdef USE_LIGHTMAP
	// Stored as the square root of the light, for precision in the shadows.
	vec3 bakedLight = texture2D( lightMap, vLightMapUv ).rgb;
	reflectedLight.directDiffuse += bakedLightsOn * bakedLight * bakedLight * lightMapIntensity * BRDF_Lambert( material.diffuseContribution );
#endif`
			)
}

/** Whether three's chunks still read as the patch expects. */
export const bakedLightsShaderMatchesThree = () =>
	ShaderChunk.lights_physical_pars_fragment.includes(LIVE_DIRECT_DIFFUSE) &&
	THREE_LIGHTMAP.test(ShaderChunk.lights_fragment_maps)

const switches = new WeakMap<Material, IUniform<number>>()

const bakedInfo = (material: Material) =>
	material.userData[BAKED_LIGHTMAP_USER_DATA] as BakedLightmapInfo | undefined

const isStandard = (material: Material): material is MeshStandardMaterial =>
	(material as MeshStandardMaterial).isMeshStandardMaterial === true

/** Every lit material a model draws, each once. */
function litMaterials(model: Object3D): MeshStandardMaterial[] {
	const found = new Set<MeshStandardMaterial>()
	model.traverse((object) => {
		const { material } = object as { material?: Material | Material[] }
		if (!material) return
		for (const entry of Array.isArray(material) ? material : [material]) {
			if (isStandard(entry)) found.add(entry)
		}
	})
	return [...found]
}

/**
 * The signature a light map must carry to be drawn for `lighting`: none while
 * the lighting does not bake its lights, so a map published earlier stops
 * showing as soon as the bake is turned off, before any republish.
 */
export const drawnLightsSignature = (lighting: ResolvedLighting) =>
	lighting.bake.lights ? bakedLightsSignature(lighting) : ''

/**
 * Draws each baked map in `model` that was baked from `signature`, at
 * `intensity` (what a light of intensity 1 delivers, as `SceneLights` sets
 * it), and the live lights' diffuse light everywhere else. The live lights
 * keep casting shadows either way: with the map drawn they shadow only their
 * highlights, which stay live.
 */
export function applyBakedLights(
	model: Object3D,
	signature: string,
	intensity: number
): void {
	for (const material of litMaterials(model)) {
		const info = bakedInfo(material)
		if (!info || !material.lightMap) continue
		const matches = Boolean(signature) && info.signature === signature

		let on = switches.get(material)
		if (!on) {
			on = { value: 0 }
			switches.set(material, on)
			const uniform = on
			const previous = material.onBeforeCompile.bind(material)
			// Read before the patch, which would change what it reads.
			const previousKey = material.customProgramCacheKey()
			material.onBeforeCompile = (shader, renderer) => {
				previous(shader, renderer)
				patchBakedLightsShader(shader, uniform)
			}
			material.customProgramCacheKey = () =>
				`${previousKey}|vectreal-baked-lights`
			material.needsUpdate = true
		}
		on.value = matches ? 1 : 0
		material.lightMapIntensity = matches ? info.scale * intensity : 0
	}
}
