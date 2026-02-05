import { CameraProps } from '@vctrl/core'

/**
 * Default camera options for the VectrealViewer.
 *
 * These defaults provide sensible values for perspective camera properties:
 * - fov: Field of view in degrees (default: 50°)
 * - near: Near clipping plane (default: 0.1)
 * - far: Far clipping plane (default: 1000)
 * - position: Initial camera position (default: [5, 5, 5])
 */
export const defaultCameraOptions: CameraProps = {
	fov: 50,
	near: 0.1,
	far: 1000,
	position: [5, 5, 5]
}
