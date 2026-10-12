/**
 * Renders one frame of a screenshot at a pose the caller sets.
 *
 * A capture waits two frames before it renders, so the scene can settle on
 * the pose. Those frames run every `useFrame` subscriber, and some of them
 * drive the camera themselves: a running camera transition writes position,
 * rotation, fov and the controls target on every frame. A pose set once before
 * the wait was therefore overwritten, and an auto-fit or target-camera capture
 * taken mid-transition rendered a pose between two cameras.
 *
 * So the pose is set again after the last waited frame, and `render` follows
 * synchronously with nothing in between. What `applyPose` sets is what
 * renders: for a pose with orbit controls that includes their `update()`,
 * which aims the camera at the controls target exactly as the live viewer
 * does. A viewport capture sets no pose and renders the live frame, so it
 * shows a transition in progress by definition.
 *
 * Pure, so the ordering is testable without a WebGL context.
 */
export async function renderAtPose({
	applyPose,
	invalidate,
	waitForNextFrame,
	render
}: {
	/** Sets the capture pose, including the projection and controls update. */
	applyPose: () => void
	invalidate: () => void
	waitForNextFrame: () => Promise<void>
	render: () => void
}): Promise<void> {
	applyPose()
	invalidate()
	await waitForNextFrame()
	invalidate()
	await waitForNextFrame()
	applyPose()
	render()
}
