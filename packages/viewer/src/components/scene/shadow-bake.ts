import {
	Mesh,
	type Object3D,
	OrthographicCamera,
	PlaneGeometry,
	RGBAFormat,
	Scene,
	ShaderMaterial,
	type Texture,
	UnsignedByteType,
	WebGLRenderTarget,
	type WebGLRenderer
} from 'three'

import type { AccumulativeShadowsProps } from '@vctrl/core'

/**
 * Cheap geometric fingerprint of the model — total vertex count. Combined with
 * the measured footprint/radius it distinguishes models that happen to share a
 * bounding box, so a different model invalidates a persisted bake.
 */
export const computeModelFingerprint = (model: Object3D): number => {
	let vertices = 0
	model.traverse((object) => {
		const geometry = (object as Mesh).geometry
		const position = geometry?.attributes?.position
		if (position) vertices += position.count
	})
	return vertices
}

/**
 * Deterministic signature of everything that changes the BAKED shadow density:
 * the bake light, frame count, plane scale, resolution and the model fingerprint.
 *
 * Deliberately excludes `opacity` and `color` — those are applied live on top of
 * the stored density at render time, so recoloring or dimming the shadow never
 * invalidates a persisted bake. Computed identically at capture time and at load
 * time so the two can be compared.
 */
export const computeBakeSignature = (
	options: Pick<
		AccumulativeShadowsProps,
		'light' | 'frames' | 'scale' | 'resolution'
	>,
	footprint: number,
	radius: number,
	fingerprint: number
): string => {
	const light = options.light ?? {}
	return [
		`fp:${fingerprint}`,
		`ft:${footprint.toFixed(3)}`,
		`rd:${radius.toFixed(3)}`,
		`fr:${options.frames}`,
		`sc:${options.scale}`,
		`rs:${options.resolution}`,
		`lp:${(light.position ?? []).map((n) => n.toFixed(3)).join(',')}`,
		`lr:${light.radius}`,
		`la:${light.ambient}`,
		`ln:${light.amount}`,
		`li:${light.intensity}`,
		`lb:${light.bias}`
	].join('|')
}

const DENSITY_VERTEX = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`

// Reproduces drei SoftShadowMaterial's alpha (the shadow density), independent of
// opacity/color: density = max(0, 1 - (r+g+b)/alphaTest). Written to the alpha
// channel; RGB stays black so the PNG is a pure density mask.
const DENSITY_FRAGMENT = /* glsl */ `
	varying vec2 vUv;
	uniform sampler2D uMap;
	uniform float uAlphaTest;
	void main() {
		vec3 c = texture2D(uMap, vUv).rgb;
		float density = max(0.0, 1.0 - (c.r + c.g + c.b) / uAlphaTest);
		gl_FragColor = vec4(0.0, 0.0, 0.0, density);
	}
`

/**
 * Renders the accumulative shadow's baked lightmap into a shadow-density PNG: a
 * data URL whose alpha channel is the shadow density (RGB black). This is the
 * persisted artifact — re-applied to a plane at load time so the bake never has
 * to run again.
 *
 * Uses the same float-readback idea as the auto-cutoff, but at full resolution
 * and through the density formula, then copies the pixels into a 2D canvas (row
 * order flipped — WebGL reads bottom-up) and exports a PNG.
 */
export const captureShadowDensity = (
	gl: WebGLRenderer,
	map: Texture,
	alphaTest: number,
	resolution: number
): string => {
	const target = new WebGLRenderTarget(resolution, resolution, {
		type: UnsignedByteType,
		format: RGBAFormat
	})
	const scene = new Scene()
	const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
	const material = new ShaderMaterial({
		uniforms: { uMap: { value: map }, uAlphaTest: { value: alphaTest } },
		vertexShader: DENSITY_VERTEX,
		fragmentShader: DENSITY_FRAGMENT
	})
	const quad = new Mesh(new PlaneGeometry(2, 2), material)
	scene.add(quad)

	const previousTarget = gl.getRenderTarget()
	gl.setRenderTarget(target)
	gl.clear()
	gl.render(scene, camera)
	const pixels = new Uint8Array(resolution * resolution * 4)
	gl.readRenderTargetPixels(target, 0, 0, resolution, resolution, pixels)
	gl.setRenderTarget(previousTarget)

	const canvas = document.createElement('canvas')
	canvas.width = resolution
	canvas.height = resolution
	const ctx = canvas.getContext('2d')
	target.dispose()
	material.dispose()
	quad.geometry.dispose()
	if (!ctx) return ''

	const image = ctx.createImageData(resolution, resolution)
	// Flip vertically: readRenderTargetPixels returns rows bottom-to-top.
	for (let y = 0; y < resolution; y++) {
		const srcRow = (resolution - 1 - y) * resolution * 4
		const dstRow = y * resolution * 4
		image.data.set(pixels.subarray(srcRow, srcRow + resolution * 4), dstRow)
	}
	ctx.putImageData(image, 0, 0)
	return canvas.toDataURL('image/png')
}
