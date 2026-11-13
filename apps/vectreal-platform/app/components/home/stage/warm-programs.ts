import * as THREE from 'three'

/** How often the compiling programs are asked whether they have finished: about once a frame. */
const POLL_MS = 16

/*
  three.js compiles a material's program the first time it is drawn, and its
  first draw then waits for the driver to finish, on the main thread. Drawn
  cold, the stage's passes held the page for over a second on a throttled
  phone. Compiled ahead, the driver builds them on its own threads
  (`KHR_parallel_shader_compile`) while the page keeps scrolling, and the first
  draw finds them done.

  A program is chosen by the state it is drawn in as well as by its material,
  so each pass is warmed as it will be drawn: into the canvas, or into an
  off-screen target (all targets share one program: no tone mapping, the
  working color space), with the lights of the scene it is drawn in.

  What is awaited is every program the renderer holds, not one per material:
  one material can need several (a transparent double-sided one, or an
  override drawn over plain and skinned meshes alike), and three keeps only the
  last as the material's own.

  Where the extension is missing (Firefox), every program reads as ready at
  once and the first draw waits as it always did: nothing is lost.
*/
export async function warmPrograms(
	renderer: THREE.WebGLRenderer,
	object: THREE.Object3D,
	camera: THREE.Camera,
	{
		offscreen = false,
		lightsFrom
	}: { offscreen?: boolean; lightsFrom?: THREE.Scene } = {}
): Promise<void> {
	const target = offscreen ? new THREE.WebGLRenderTarget(1, 1) : null
	const previous = renderer.getRenderTarget()
	renderer.setRenderTarget(target)
	renderer.compile(object, camera, lightsFrom)
	renderer.setRenderTarget(previous)
	target?.dispose()
	// Polled here rather than through `compileAsync`, which throws from its timer once the renderer is disposed mid-compile.
	// three's own program objects, typed in `@types/three` without the readiness check they carry.
	const programs = () =>
		(renderer.info.programs ?? []) as unknown as {
			isReady: () => boolean | null
		}[]
	const compiling = () => programs().some((p) => p.isReady() === false)
	while (compiling() && !pageHidden())
		await new Promise((resolve) => setTimeout(resolve, POLL_MS))
}

/*
  A hidden tab throttles timers to one a second, later one a minute, and
  nobody is watching its main thread: there the stage stops waiting and draws
  as it did before, so it is ready when the tab comes back.
*/
export const pageHidden = () => globalThis.document?.hidden === true

/**
 * The model's meshes with every material swapped for `material`: what a pass
 * that draws the scene through an override material compiles. Geometry is
 * shared, so it costs no upload.
 */
export function withMaterial(
	model: THREE.Object3D,
	material: THREE.Material
): THREE.Group {
	const group = new THREE.Group()
	model.updateMatrixWorld(true)
	model.traverse((o) => {
		if (!(o as THREE.Mesh).isMesh) return
		const copy = o.clone(false) as THREE.Mesh
		copy.material = material
		group.add(copy)
	})
	return group
}
