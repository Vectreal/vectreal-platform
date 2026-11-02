import { VectrealViewer } from '@vctrl/viewer'
import { useState } from 'react'

/*
  Two scene cameras on a slow linear move, in a host that follows the viewer:
  `camera_changed` is written back as `activeCameraId`, as the platform's
  publisher does and as the viewer's docs describe for a host drawing its own
  switcher. A switch made from the viewer's own switcher must still fly. It
  landed at once in the publisher for a release, because the echo read as an
  edit to the camera in view.
*/
const CAMERAS = [
	{
		cameraId: 'front',
		name: 'Front',
		initial: true,
		position: [0, 0.5, 6] as [number, number, number],
		target: [0, 0, 0] as [number, number, number]
	},
	{
		cameraId: 'side',
		name: 'Side',
		position: [6, 0.5, 0] as [number, number, number],
		target: [0, 0, 0] as [number, number, number]
	}
]

export function CameraEchoCase() {
	const [activeCameraId, setActiveCameraId] = useState('front')

	return (
		<div style={{ height: '100vh', width: '100vw' }}>
			<VectrealViewer
				controlsOptions={{ autoRotate: false }}
				cameraOptions={{
					activeCameraId,
					cameras: CAMERAS,
					sceneTransition: {
						type: 'linear',
						duration: 2000,
						easing: 'linear'
					}
				}}
				onCameraSnapshotCaptureReady={(capture) => {
					window.__CAMERA_ECHO__ = capture ?? undefined
				}}
				onInteractionEvent={(event) => {
					if (event.type === 'viewer_ready') window.__VIEWER_READY__ = true
					if (event.type === 'camera_changed') {
						setActiveCameraId(event.cameraId)
					}
				}}
			>
				<ambientLight intensity={0.8} />
				<mesh>
					<boxGeometry args={[1.2, 1.2, 1.2]} />
					<meshStandardMaterial color="#60a5fa" />
				</mesh>
			</VectrealViewer>
		</div>
	)
}
