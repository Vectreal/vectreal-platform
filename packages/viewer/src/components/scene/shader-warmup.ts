import type {
	Camera,
	Material,
	Scene,
	WebGLRenderTarget,
	WebGLRenderer
} from 'three'

/** How often to ask the driver whether the programs have finished. */
const POLL_INTERVAL_MS = 10

interface MaterialProperties {
	currentProgram?: { isReady(): boolean }
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
