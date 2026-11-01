import { Color, Vector3, type WebGLRenderer } from 'three'

import { traceInUvSpace, type UvBake } from '../occlusion-bake/uv-trace'
import { lightDirection, litLights } from '../scene-lighting/light-direction'

import type { OcclusionBakePlan } from '../occlusion-bake/plan'
import type { ResolvedLighting } from '../scene-lighting/resolve-lighting'
import type { MAX_SCENE_LIGHTS } from '../types'

/** One material's baked lights, with the scale its texels decode by. */
export interface BakedLightmap extends UvBake {
	scale: number
}

export interface LightBakeOptions {
	/** Texels per side of each material's map. */
	resolution: number
	/** Shadow rays per light per texel. */
	samples: number
}

export const DEFAULT_LIGHT_BAKE_OPTIONS: LightBakeOptions = {
	resolution: 512,
	samples: 128
}

/** Sized for the shader's arrays; see {@link MAX_SCENE_LIGHTS}. */
const LIGHT_SLOTS: typeof MAX_SCENE_LIGHTS = 3

/**
 * The most light a texel can hold: every light full on a surface facing it.
 * Encoding against it never clips.
 */
export function lightmapScale(
	lighting: Pick<ResolvedLighting, 'lights'>
): number {
	return litLights(lighting).reduce((sum, light) => {
		const { r, g, b } = new Color(light.color)
		return sum + light.intensity * Math.max(r, g, b)
	}, 0)
}

/*
  Each texel samples every lit light across its angular size and adds what
  each sample delivers, `color * intensity * dotNL`, where nothing in the scene
  blocks the way. In the units of a light's `intensity`, relative to the
  environment, so the viewer scales it by the environment's measured light
  exactly as it scales the live lights. Stored as the square root of its share
  of `lightmapScale`, which spends the eight bits where shadows are.

  Empty when no light contributes or nothing can be baked.
*/
export async function bakeLights(
	plan: OcclusionBakePlan,
	lighting: Pick<ResolvedLighting, 'lights' | 'environment'>,
	renderer: WebGLRenderer,
	options: LightBakeOptions = DEFAULT_LIGHT_BAKE_OPTIONS,
	onProgress?: (fraction: number) => void
): Promise<BakedLightmap[]> {
	const lights = litLights(lighting).slice(0, LIGHT_SLOTS)
	const scale = lightmapScale({ lights })
	if (lights.length === 0 || scale <= 0 || plan.targets.length === 0) return []

	const slot = <T>(values: T[], empty: T) =>
		Array.from({ length: LIGHT_SLOTS }, (_, i) => values[i] ?? empty)
	const directions = lights.map(
		(light) =>
			new Vector3(...lightDirection(light, lighting.environment.rotation))
	)
	const colors = lights.map((light) =>
		new Vector3()
			.setFromColor(new Color(light.color))
			.multiplyScalar(light.intensity)
	)
	const cosHalf = lights.map((light) =>
		Math.cos(((light.size / 2) * Math.PI) / 180)
	)

	const baked = await traceInUvSpace(renderer, {
		targets: plan.targets,
		primitives: plan.primitives,
		size: options.resolution,
		samples: options.samples,
		traceFragment: TRACE_FRAGMENT,
		uniforms: {
			lightCount: { value: lights.length },
			lightDirections: { value: slot(directions, new Vector3(0, 1, 0)) },
			lightColors: { value: slot(colors, new Vector3()) },
			lightCosHalf: { value: slot(cosHalf, 1) },
			scale: { value: scale }
		},
		resolveFragment: RESOLVE_FRAGMENT,
		empty: [0, 0, 0, 255],
		label: 'the studio lights',
		onProgress
	})
	// Undefined when nothing casts, so every target is glass: it throws no
	// shadow to bake, and the live lights draw it as well as a map would.
	return (baked ?? []).map((bake) => ({ ...bake, scale }))
}

const TRACE_FRAGMENT = /* glsl */ `
uniform int lightCount;
uniform vec3 lightDirections[${LIGHT_SLOTS}];
uniform vec3 lightColors[${LIGHT_SLOTS}];
uniform float lightCosHalf[${LIGHT_SLOTS}];

void main() {
	vec3 normal = normalize(vNormal);
	vec3 origin = vPosition + normal * bias;

	vec3 light = vec3(0.0);
	for (int i = 0; i < passSamples; i++) {
		vec2 xi = sampleAt(firstSample + i);
		for (int l = 0; l < lightCount; l++) {
			// Uniform over the light's disc as seen from the surface.
			float cosTheta = 1.0 - xi.x * (1.0 - lightCosHalf[l]);
			float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
			float phi = 6.283185307179586 * xi.y;
			vec3 direction = aroundAxis(lightDirections[l], sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
			float facing = dot(normal, direction);
			if (facing <= 0.0) continue;
			if (!blocked(origin, direction, 1e30)) light += lightColors[l] * facing;
		}
	}
	// Alpha sums to the number of surfaces drawn into this texel, so the
	// resolve can average a texel two triangles share.
	fragColor = vec4(light, float(passSamples)) / float(totalSamples);
}
`

const RESOLVE_FRAGMENT = /* glsl */ `
uniform sampler2D accumulated;
uniform float scale;
in vec2 vUv;
out vec4 fragColor;

void main() {
	vec4 sum = texture(accumulated, vUv);
	float covered = sum.a > 0.0 ? 1.0 : 0.0;
	vec3 light = covered > 0.0 ? sum.rgb / sum.a : vec3(0.0);
	fragColor = vec4(sqrt(clamp(light / scale, 0.0, 1.0)), covered);
}
`
