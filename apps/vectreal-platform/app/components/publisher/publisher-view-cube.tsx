import { GizmoHelper, GizmoViewcube } from '@react-three/drei'
import { useAtomValue } from 'jotai/react'

import { shadowsAtom } from '../../lib/stores/scene-settings-store'

/**
 * Orientation cube for the publisher's editing canvas — click a face to snap the
 * camera to an absolute view. Lives in the app (not `@vctrl/viewer`) so the
 * published viewer package stays slim; rendered inside the viewer's Canvas as a
 * child via PublisherEditorScene.
 */
export const PublisherViewCube = () => {
	const shadows = useAtomValue(shadowsAtom)
	// drei's Hud re-renders the whole scene at renderPriority 1, which would
	// clobber the AO EffectComposer (also priority 1) the viewer mounts when AO is
	// on. At priority 2 the Hud skips that scene re-render and just overlays the
	// cube on top of the composed frame. Mirror the viewer's AO gate so the cube
	// and postprocessing coexist; without AO there's no composer, so 1 is correct.
	const aoEnabled =
		(shadows?.enabled ?? false) &&
		shadows?.type === 'accumulative' &&
		(shadows.ao ?? false)

	return (
		<GizmoHelper
			alignment="bottom-left"
			margin={[72, 72]}
			renderPriority={aoEnabled ? 2 : 1}
		>
			<GizmoViewcube
				color="#f4f4f5"
				textColor="#52525b"
				strokeColor="#d4d4d8"
				hoverColor="#fbbf24"
			/>
		</GizmoHelper>
	)
}
