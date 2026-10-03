import type { Camera, Scene, WebGLRenderTarget, WebGLRenderer } from 'three'

/**
 * Compiles every material in the scene off the main thread, for the target
 * the scene will actually be drawn into.
 *
 * Left to the first frame, a material compiles inside `render()`, and three
 * then reads the result back synchronously: the page freezes, loader spinner
 * included, until the driver has finished every program. `compileAsync`
 * starts the same compiles and polls `KHR_parallel_shader_compile` instead.
 *
 * The target matters because three keys a program on its output: a scene
 * compiled for the canvas (sRGB, tone mapped) does not satisfy a draw into
 * the composer's linear buffer, and would only compile everything twice.
 */
export const warmUpShaders = (
	gl: WebGLRenderer,
	scene: Scene,
	camera: Camera,
	target: WebGLRenderTarget | null
): Promise<unknown> => {
	// Programs are keyed while `compileAsync` runs synchronously; only the
	// polling is deferred. So the target is held for the call alone, and never
	// across the frames that render while the driver finishes.
	const previousTarget = gl.getRenderTarget()
	gl.setRenderTarget(target)
	try {
		return gl.compileAsync(scene, camera)
	} finally {
		gl.setRenderTarget(previousTarget)
	}
}
