import { GizmoHelper, GizmoViewcube } from '@react-three/drei'

/**
 * Orientation cube for the publisher's editing canvas — click a face to snap the
 * camera to an absolute view. Lives in the app (not `@vctrl/viewer`) so the
 * published viewer package stays slim; rendered inside the viewer's Canvas as a
 * child via PublisherEditorScene.
 */
export const PublisherViewCube = () => (
	// drei's Hud re-renders the whole scene itself at renderPriority 1, which
	// would clobber the viewer's composer (also priority 1, and mounted whenever
	// post-processing is on, which the publisher never turns off). At priority 2
	// the Hud skips that scene render and overlays the cube on the composed
	// frame; the composer redraws its converged image under it while at rest.
	<GizmoHelper alignment="bottom-left" margin={[72, 72]} renderPriority={2}>
		<GizmoViewcube
			color="#f4f4f5"
			textColor="#52525b"
			strokeColor="#d4d4d8"
			hoverColor="#fbbf24"
		/>
	</GizmoHelper>
)
