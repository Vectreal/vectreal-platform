import type {
	Camera,
	Material,
	Mesh,
	Scene,
	Texture,
	WebGLRenderTarget,
	WebGLRenderer
} from 'three'

/** How often to ask the driver whether the programs have finished. */
const POLL_INTERVAL_MS = 10

interface MaterialProperties {
	currentProgram?: { isReady(): boolean }
}

interface TextureProperties {
	__version?: number
}

/** Every texture the scene's meshes sample, once each. */
export const collectSceneTextures = (scene: Scene): Texture[] => {
	const textures = new Set<Texture>()
	scene.traverse((object) => {
		const material = (object as Mesh).material
		if (!material) return
		for (const entry of Array.isArray(material) ? material : [material]) {
			for (const value of Object.values(entry)) {
				if ((value as Texture | null)?.isTexture) textures.add(value as Texture)
			}
		}
	})
	return [...textures]
}

/** How long one task may spend uploading before the browser gets a turn. */
const UPLOAD_SLICE_MS = 8

/** Gives the browser a turn: a frame of the loader, a click, a paint. */
const yieldToMain = () =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, 0)
	})

/**
 * Uploads textures to the GPU in tasks of about `UPLOAD_SLICE_MS` each.
 *
 * `compile` builds programs but uploads nothing, so every `texImage2D` - and
 * the mipmaps behind it - otherwise landed in the first frame, all in one
 * task. A large texture still takes a task of its own, but the browser runs
 * between tasks. Small ones share a task: browsers delay nested timers by at
 * least 4 ms, so one task per texture made a model with many textures slow to
 * appear however cheap its uploads were.
 */
export const uploadTexturesInSlices = async (
	gl: WebGLRenderer,
	textures: readonly Texture[],
	isCancelled: () => boolean
): Promise<void> => {
	let sliceStart = Number.NEGATIVE_INFINITY
	for (const texture of textures) {
		const uploaded =
			(gl.properties.get(texture) as TextureProperties).__version ===
			texture.version
		if (uploaded || !texture.image) continue
		if (performance.now() - sliceStart >= UPLOAD_SLICE_MS) {
			await yieldToMain()
			if (isCancelled()) return
			sliceStart = performance.now()
		}
		gl.initTexture(texture)
	}
}

/**
 * Compiles every material in the scene off the main thread, for the target
 * the scene will actually be drawn into.
 *
 * Left to the first frame, a material compiles inside `render()`, and three
 * then reads the result back synchronously: the page freezes, loader spinner
 * included, until the driver has finished every program. `compile` starts
 * the same work without waiting, and `isReady` asks
 * `KHR_parallel_shader_compile` whether it is done; where the extension is
 * missing it answers yes at once, and the first frame compiles as before.
 *
 * The target matters because three keys a program on its output: a scene
 * compiled for the canvas (sRGB, tone mapped) does not satisfy a draw into
 * the composer's linear buffer, and would only compile everything twice.
 *
 * Polled here rather than through `compileAsync`, whose poll reads each
 * material's program without checking it still exists: a material disposed
 * while it waits throws inside a timer, and the promise never settles.
 */
export const warmUpShaders = (
	gl: WebGLRenderer,
	scene: Scene,
	camera: Camera,
	target: WebGLRenderTarget | null
): Promise<void> => {
	// Programs are keyed while `compile` runs; only the waiting is deferred.
	// So the target is held for the call alone, and never across the frames
	// that render while the driver finishes.
	const previousTarget = gl.getRenderTarget()
	gl.setRenderTarget(target)
	let pending: Set<Material>
	try {
		pending = gl.compile(scene, camera)
	} finally {
		gl.setRenderTarget(previousTarget)
	}

	const isSettled = (material: Material) => {
		if (!gl.properties.has(material)) return true
		const { currentProgram } = gl.properties.get(material) as MaterialProperties
		return !currentProgram || currentProgram.isReady()
	}

	return new Promise((resolve) => {
		const poll = () => {
			for (const material of pending) {
				if (isSettled(material)) pending.delete(material)
			}
			if (pending.size === 0) resolve()
			else setTimeout(poll, POLL_INTERVAL_MS)
		}
		poll()
	})
}

/**
 * Everything the first frame of a scene would otherwise do on the main thread
 * in one go: compile its programs, then upload its textures.
 *
 * Never rejects. The viewer draws nothing until this settles, and a lost
 * context makes `compile` throw, so a failure only gives the work back to the
 * first frame, where it ran before the warm-up existed.
 */
export const warmUpScene = async (
	gl: WebGLRenderer,
	scene: Scene,
	camera: Camera,
	target: WebGLRenderTarget | null,
	isCancelled: () => boolean
): Promise<void> => {
	try {
		await warmUpShaders(gl, scene, camera, target)
		if (isCancelled()) return
		await uploadTexturesInSlices(gl, collectSceneTextures(scene), isCancelled)
	} catch {
		return
	}
}
