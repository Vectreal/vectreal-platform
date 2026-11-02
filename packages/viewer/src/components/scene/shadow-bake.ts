import {
	FloatType,
	Mesh,
	MeshBasicMaterial,
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

/**
 * Resolution (px, square) of the persisted shadow-density PNG. Independent of the
 * bake's own `resolution` (which controls bake quality); the stored mask is a
 * low-frequency soft shadow that downscales cleanly, so a smaller size keeps the
 * asset (base64-inlined into the scene aggregate) lean.
 */
export const PERSISTED_BAKE_RESOLUTION = 512

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

// The signature and the rule for a stored bake live in `@vctrl/core`, so the
// dashboard asks the question the viewer's gate asks, without the viewer.
export {
	computeBakeSignature,
	isPersistedBakeValid,
	type BakeSignatureOptions
} from '@vctrl/core'

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
 * Uses the same float-readback idea as measureLitBrightness, but at full resolution
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

// Lightmap UVs sampled for the LIT brightness. The model's shadow sits at the
// center, so these edge/corner points read the fully-lit plane; the max across
// them is taken so a sample that happens to land in penumbra can't drag the
// estimate down.
const LIT_SAMPLES: ReadonlyArray<readonly [number, number]> = [
	[0.04, 0.04],
	[0.96, 0.96],
	[0.96, 0.04],
	[0.04, 0.96],
	[0.5, 0.04],
	[0.04, 0.5]
]

const READBACK_RES = 32

/**
 * Measures the maximum (lit) brightness of the baked lightmap by drawing it to a
 * small float target and reading back a few edge samples. Values are linear: the
 * basic material is untonemapped and the target is float, so the readback is the
 * raw accumulated irradiance.
 */
export const measureLitBrightness = (
	gl: WebGLRenderer,
	map: Texture
): number => {
	const target = new WebGLRenderTarget(READBACK_RES, READBACK_RES, {
		type: FloatType
	})
	const scene = new Scene()
	const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
	const material = new MeshBasicMaterial({ map, toneMapped: false })
	const quad = new Mesh(new PlaneGeometry(2, 2), material)
	scene.add(quad)

	const previous = gl.getRenderTarget()
	gl.setRenderTarget(target)
	gl.render(scene, camera)
	const pixels = new Float32Array(READBACK_RES * READBACK_RES * 4)
	gl.readRenderTargetPixels(target, 0, 0, READBACK_RES, READBACK_RES, pixels)
	gl.setRenderTarget(previous)

	let maxSum = 0
	for (const [u, v] of LIT_SAMPLES) {
		const x = Math.floor(u * (READBACK_RES - 1))
		const y = Math.floor(v * (READBACK_RES - 1))
		const i = (y * READBACK_RES + x) * 4
		maxSum = Math.max(maxSum, pixels[i] + pixels[i + 1] + pixels[i + 2])
	}

	target.dispose()
	material.dispose()
	quad.geometry.dispose()
	return maxSum
}
