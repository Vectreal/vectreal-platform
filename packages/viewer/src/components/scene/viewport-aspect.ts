import type { Camera, PerspectiveCamera } from 'three'

/**
 * The aspect a camera's pose is fitted to, or `undefined` for a camera the fit
 * does not apply to.
 *
 * The fit backs a perspective camera off its target (`framingScale`). An
 * orthographic camera has no distance that changes what it frames, so it is
 * skipped rather than guessed at: its poses are shown as stored. The viewer's
 * canvas only ever makes perspective cameras today; this keeps the rule
 * defined if that changes.
 */
export function viewportAspectOf(camera: Camera): number | undefined {
	return (camera as PerspectiveCamera).isPerspectiveCamera
		? (camera as PerspectiveCamera).aspect
		: undefined
}
