import { Pass } from 'postprocessing'
import {
	HalfFloatType,
	NoBlending,
	ShaderMaterial,
	Uniform,
	WebGLRenderTarget,
	type Texture,
	type WebGLRenderer
} from 'three'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
	vUv = position.xy * 0.5 + 0.5;
	gl_Position = vec4(position.xy, 1.0, 1.0);
}
`

// Running average: with weight 1 / (n + 1), sample n leaves the history holding
// the plain mean of samples 0..n. The same material presents a texture
// unchanged at weight 1, and converts to the output color space when the
// target is the canvas.
const fragmentShader = /* glsl */ `
uniform sampler2D inputBuffer;
uniform sampler2D history;
uniform float weight;
varying vec2 vUv;
void main() {
	vec4 current = texture2D(inputBuffer, vUv);
	vec4 previous = texture2D(history, vUv);
	gl_FragColor = mix(previous, current, weight);
	#include <colorspace_fragment>
}
`

/**
 * The final pass of the viewer's composer. Owns the presented image:
 *
 * - `present(keepHistory)`: draw this frame's input to the canvas (motion).
 *   With `keepHistory` it is kept as the history too, so a redraw shows the
 *   last frame presented; that costs a full-size copy, so only a canvas
 *   something else draws over asks for it.
 * - `accumulate(sample)`: fold this frame's input into the running average,
 *   then draw the average to the canvas (at rest, jittered).
 * - `presentHistory()`: redraw the last presented frame without rendering
 *   the scene, for when something else draws onto the same canvas each frame:
 *   at rest, or while a new model's shaders compile.
 *
 * Averaging happens after tone mapping, in linear half-float: resolving
 * display-referred values is what keeps bright edges from aliasing.
 */
export class AccumulatePass extends Pass {
	private readonly material: ShaderMaterial
	private read: WebGLRenderTarget
	private write: WebGLRenderTarget
	private mode: 'present' | 'accumulate' = 'present'
	private sample = 0
	private keepHistory = false

	constructor() {
		super('AccumulatePass')
		this.material = new ShaderMaterial({
			name: 'AccumulateMaterial',
			uniforms: {
				inputBuffer: new Uniform<Texture | null>(null),
				history: new Uniform<Texture | null>(null),
				weight: new Uniform(1)
			},
			vertexShader,
			fragmentShader,
			blending: NoBlending,
			depthWrite: false,
			depthTest: false,
			toneMapped: false
		})
		this.fullscreenMaterial = this.material
		this.read = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
		this.write = new WebGLRenderTarget(1, 1, { type: HalfFloatType })
		this.needsSwap = false
	}

	present(keepHistory: boolean) {
		this.mode = 'present'
		this.keepHistory = keepHistory
	}

	accumulate(sample: number) {
		this.mode = 'accumulate'
		this.sample = sample
	}

	/** Redraws the last presented frame onto the canvas. */
	presentHistory(renderer: WebGLRenderer) {
		this.draw(renderer, this.read.texture, this.read.texture, 1, null)
	}

	override render(
		renderer: WebGLRenderer,
		inputBuffer: WebGLRenderTarget | null
	) {
		const input = inputBuffer?.texture ?? null
		const output = this.renderToScreen ? null : inputBuffer

		if (this.mode === 'present' && !this.keepHistory) {
			this.draw(renderer, input, input, 1, output)
			return
		}

		if (this.mode === 'present') {
			this.draw(renderer, input, input, 1, this.read)
			this.draw(renderer, this.read.texture, this.read.texture, 1, output)
			return
		}

		this.draw(
			renderer,
			input,
			this.read.texture,
			1 / (this.sample + 1),
			this.write
		)
		const settled = this.write
		this.write = this.read
		this.read = settled
		this.draw(renderer, settled.texture, settled.texture, 1, output)
	}

	private draw(
		renderer: WebGLRenderer,
		input: Texture | null,
		history: Texture | null,
		weight: number,
		target: WebGLRenderTarget | null
	) {
		this.material.uniforms.inputBuffer.value = input
		this.material.uniforms.history.value = history
		this.material.uniforms.weight.value = weight
		renderer.setRenderTarget(target)
		renderer.render(this.scene, this.camera)
	}

	override setSize(width: number, height: number) {
		this.read.setSize(width, height)
		this.write.setSize(width, height)
	}

	override dispose() {
		this.read.dispose()
		this.write.dispose()
		super.dispose()
	}
}
