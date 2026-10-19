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

interface Program {
	isReady(): boolean
}

interface MaterialProperties {
	currentProgram?: Program
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

/** One draw the viewer will make: a scene, through a camera, into a target. */
export interface ShaderDraw {
	scene: Scene
	camera: Camera
	target: WebGLRenderTarget | null
}

/**
 * Compiles every material of each draw off the main thread, for the target
 * that draw will actually render into.
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
 * the composer's linear buffer, and would only compile everything twice. For
 * the same reason one material drawn into two targets has two programs, and
 * each target's is awaited: `currentProgram` names only the one compiled last.
 * (A transparent double-sided material also gets a back-face program per
 * target, which `currentProgram` does not name and nothing here awaits.)
 *
 * Polled here rather than through `compileAsync`, whose poll reads each
 * material's program without checking it still exists: a material disposed
 * while it waits throws inside a timer, and the promise never settles.
 */
export const warmUpShaders = (
	gl: WebGLRenderer,
	draws: readonly ShaderDraw[]
): Promise<void> => {
	// Programs are keyed while `compile` runs; only the waiting is deferred.
	// So each target is held for its call alone, and never across the frames
	// that render while the driver finishes.
	const previousTarget = gl.getRenderTarget()
	const pending = new Set<{ material: Material; program?: Program }>()
	try {
		for (const { scene, camera, target } of draws) {
			gl.setRenderTarget(target)
			for (const material of gl.compile(scene, camera)) {
				const { currentProgram } = gl.properties.get(
					material
				) as MaterialProperties
				pending.add({ material, program: currentProgram })
			}
		}
	} finally {
		gl.setRenderTarget(previousTarget)
	}

	const isSettled = ({
		material,
		program
	}: {
		material: Material
		program?: Program
	}) =>
		!gl.properties.has(material) ||
		!program ||
		// Released: its material was disposed, perhaps already drawn again
		// with a program of its own. A deleted program never reports ready.
		(gl.info.programs as unknown as Program[] | null)?.includes(program) ===
			false ||
		program.isReady()

	return new Promise((resolve) => {
		const poll = () => {
			for (const entry of pending) {
				if (isSettled(entry)) pending.delete(entry)
			}
			if (pending.size === 0) resolve()
			else setTimeout(poll, POLL_INTERVAL_MS)
		}
		poll()
	})
}

/**
 * Everything the first frames of a scene would otherwise do on the main
 * thread in one go: compile the programs of every draw, then upload the
 * textures they sample.
 *
 * Never rejects. The viewer draws nothing until this settles, and a lost
 * context makes `compile` throw, so a failure only gives the work back to the
 * first frame, where it ran before the warm-up existed.
 */
export const warmUpScene = async (
	gl: WebGLRenderer,
	draws: readonly ShaderDraw[],
	isCancelled: () => boolean
): Promise<void> => {
	try {
		await warmUpShaders(gl, draws)
		if (isCancelled()) return
		const textures = new Set(
			draws.flatMap(({ scene }) => collectSceneTextures(scene))
		)
		await uploadTexturesInSlices(gl, [...textures], isCancelled)
	} catch {
		return
	}
}
