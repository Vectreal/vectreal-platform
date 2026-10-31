import {
	DEFAULT_OCCLUSION_BAKE_OPTIONS,
	type OcclusionBakeOptions
} from './options'
import { encodeBakePng, traceInUvSpace, type UvBake } from './uv-trace'

import type { OcclusionBakePlan } from './plan'
import type { WebGLRenderer } from 'three'

/** One material's occlusion as RGBA bytes, grey in every color channel. */
export type BakedOcclusion = UvBake

/** The most rays a texel can take: half-float counts are exact only up to 2048. */
const MAX_SAMPLES = 2048

/*
  Each texel sends cosine-weighted rays from the surface point it covers and
  counts the share that leave the model within `distance` scene diagonals.
*/
export async function bakeOcclusion(
	plan: OcclusionBakePlan,
	renderer: WebGLRenderer,
	options: OcclusionBakeOptions = DEFAULT_OCCLUSION_BAKE_OPTIONS
): Promise<BakedOcclusion[]> {
	const { resolution: size, distance } = options
	const baked = await traceInUvSpace(renderer, {
		targets: plan.targets,
		primitives: plan.primitives,
		size,
		samples: Math.min(options.samples, MAX_SAMPLES),
		traceFragment: TRACE_FRAGMENT,
		uniforms: { reach: { value: distance } },
		resolveFragment: RESOLVE_FRAGMENT,
		empty: [255, 255, 255, 255],
		label: 'ambient occlusion'
	})
	// Nothing casts, so nothing is occluded.
	return (
		baked ??
		plan.targets.map(({ material }) => ({
			material,
			size,
			pixels: new Uint8Array(size * size * 4).fill(255)
		}))
	)
}

/** RGBA bytes from `bakeOcclusion` as a PNG, in a browser or worker. */
export const encodeOcclusionPng = encodeBakePng

const TRACE_FRAGMENT = /* glsl */ `
uniform float reach;

void main() {
	vec3 normal = normalize(vNormal);
	vec3 origin = vPosition + normal * bias;

	float open = 0.0;
	for (int i = 0; i < passSamples; i++) {
		vec2 xi = sampleAt(firstSample + i);
		float r = sqrt(xi.x);
		float phi = 6.283185307179586 * xi.y;
		vec3 direction = aroundAxis(normal, r * cos(phi), r * sin(phi), sqrt(max(0.0, 1.0 - xi.x)));
		if (!blocked(origin, direction, reach * diagonal)) open += 1.0;
	}
	fragColor = vec4(open, float(passSamples), 0.0, 1.0);
}
`

const RESOLVE_FRAGMENT = /* glsl */ `
uniform sampler2D accumulated;
in vec2 vUv;
out vec4 fragColor;

void main() {
	vec4 sum = texture(accumulated, vUv);
	float covered = sum.g > 0.0 ? 1.0 : 0.0;
	fragColor = vec4(vec3(covered > 0.0 ? sum.r / sum.g : 1.0), covered);
}
`
