import {
	type Camera,
	Color,
	HalfFloatType,
	type Light,
	type Material,
	type Mesh,
	MeshLambertMaterial,
	NearestFilter,
	type Object3D,
	type Scene,
	ShaderMaterial,
	type Texture,
	WebGLRenderTarget,
	type WebGLRenderer
} from 'three'

/**
 * Accumulates the light reaching a plane into a texture, one jittered frame at a
 * time, by rendering the plane in its own UV space and averaging each frame into
 * the previous result.
 *
 * Ported from drei's `ProgressiveLightMap` (MIT, pmndrs/drei, itself based on
 * zalo's "Progressive Light Map Accumulator") so the viewer owns the bake's
 * lifecycle. Two departures: `texture` is always the buffer written last (drei's
 * plane always reads the second buffer, which holds the frame before last when
 * the frame count is even), and `dispose()` frees what the constructor
 * allocates.
 */
export class ProgressiveLightMap {
	private readonly buffers: [WebGLRenderTarget, WebGLRenderTarget]
	private writeIndex = 0
	private readonly discardMaterial = new ShaderMaterial({
		vertexShader: 'void main() { gl_Position = vec4(0.0); }',
		fragmentShader: 'void main() { discard; }'
	})
	private readonly targetMaterial = new MeshLambertMaterial({ fog: false })
	private readonly previousMap: { value: Texture }
	private readonly averagingWindow = { value: 100 }
	private lights: Array<{ object: Light; intensity: number }> = []
	private meshes: Array<{ object: Mesh; material: Material | Material[] }> = []
	private readonly clearColor = new Color()

	constructor(
		private readonly renderer: WebGLRenderer,
		private readonly scene: Scene,
		resolution: number
	) {
		const options = {
			type: HalfFloatType,
			magFilter: NearestFilter,
			minFilter: NearestFilter
		}
		this.buffers = [
			new WebGLRenderTarget(resolution, resolution, options),
			new WebGLRenderTarget(resolution, resolution, options)
		]
		this.previousMap = { value: this.buffers[1].texture }

		const previousMap = this.previousMap
		const averagingWindow = this.averagingWindow
		this.targetMaterial.onBeforeCompile = (shader) => {
			// Draw the surface at its unwrapped UV position, so each texel of the
			// target is one point on the plane.
			shader.vertexShader =
				'varying vec2 vUv;\n' +
				shader.vertexShader.slice(0, -1) +
				'vUv = uv; gl_Position = vec4((uv - 0.5) * 2.0, 1.0, 1.0); }'
			// Blend this frame's lighting into the running average.
			const bodyStart = shader.fragmentShader.indexOf('void main() {')
			shader.fragmentShader =
				'varying vec2 vUv;\n' +
				shader.fragmentShader.slice(0, bodyStart) +
				'uniform sampler2D previousShadowMap;\nuniform float averagingWindow;\n' +
				shader.fragmentShader.slice(bodyStart - 1, -1) +
				`\nvec3 texelOld = texture2D(previousShadowMap, vUv).rgb;
				gl_FragColor.rgb = mix(texelOld, gl_FragColor.rgb, 1.0 / averagingWindow);
				}`
			shader.uniforms.previousShadowMap = previousMap
			shader.uniforms.averagingWindow = averagingWindow
		}
	}

	/** The accumulated light, as of the last frame. */
	get texture(): Texture {
		return this.buffers[1 - this.writeIndex].texture
	}

	/**
	 * Empties both buffers and snapshots the scene's meshes and lights, which
	 * every following frame draws. Call again to bake a changed scene.
	 * `bakeLights` holds the lights doing the baking, which must stay lit.
	 */
	clear(bakeLights: Object3D) {
		const { renderer } = this
		renderer.getClearColor(this.clearColor)
		const clearAlpha = renderer.getClearAlpha()
		const previousTarget = renderer.getRenderTarget()
		renderer.setClearColor('black', 1)
		for (const buffer of this.buffers) {
			renderer.setRenderTarget(buffer)
			renderer.clear()
		}
		renderer.setRenderTarget(previousTarget)
		renderer.setClearColor(this.clearColor, clearAlpha)

		this.lights = []
		this.meshes = []
		this.scene.traverse((object) => {
			if ((object as Mesh).geometry) {
				const mesh = object as Mesh
				this.meshes.push({ object: mesh, material: mesh.material })
			} else if ((object as Light).isLight && object.parent !== bakeLights) {
				const light = object as Light
				this.lights.push({ object: light, intensity: light.intensity })
			}
		})
	}

	/** Silences the scene so only the bake's own lights reach the plane. */
	prepare() {
		for (const light of this.lights) light.object.intensity = 0
		for (const mesh of this.meshes) mesh.object.material = this.discardMaterial
	}

	/** Restores what {@link prepare} silenced. */
	finish() {
		for (const light of this.lights) light.object.intensity = light.intensity
		for (const mesh of this.meshes) mesh.object.material = mesh.material
	}

	/** Accumulates one frame into the plane's light map. */
	update(plane: Mesh, camera: Camera, blend: number) {
		const { renderer, scene } = this
		this.averagingWindow.value = blend
		plane.material = this.targetMaterial
		const write = this.buffers[this.writeIndex]
		this.previousMap.value = this.buffers[1 - this.writeIndex].texture
		this.writeIndex = 1 - this.writeIndex

		const background = scene.background
		const previousTarget = renderer.getRenderTarget()
		scene.background = null
		renderer.setRenderTarget(write)
		renderer.render(scene, camera)
		renderer.setRenderTarget(previousTarget)
		scene.background = background
	}

	dispose() {
		for (const buffer of this.buffers) buffer.dispose()
		this.discardMaterial.dispose()
		this.targetMaterial.dispose()
	}
}
