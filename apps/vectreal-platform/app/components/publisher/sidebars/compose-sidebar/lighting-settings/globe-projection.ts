import { lightDirection } from '@vctrl/core'

const RADIANS = Math.PI / 180

/** Where the globe is seen from: the orbit camera's side, in degrees. */
export interface GlobeView {
	azimuth: number
	elevation: number
}

/**
 * How the globe is seen before the viewer reports its camera: from the
 * model's front (+Z), lifted so its horizon reads as a ring, the way the
 * viewer's camera usually opens.
 */
export const DEFAULT_GLOBE_VIEW: GlobeView = { azimuth: 0, elevation: 22 }

/** A direction as the globe draws it, in radii from its center, y down. */
export interface GlobePoint {
	x: number
	y: number
	/** Whether it is on the half of the globe that faces the viewer. */
	front: boolean
}

/**
 * How far above the horizon the globe is seen, negative from below: the
 * camera's vertical limit can let it orbit under the model.
 */
export const globeTilt = (view: GlobeView) =>
	Math.min(90, Math.max(-90, view.elevation))

/*
  The globe is seen from where the camera is, so it shows the sky as the
  scene on screen has it. A direction's azimuth is turned by the environment's
  rotation exactly as the scene turns it, then back by the camera's azimuth,
  which puts the camera's side at the globe's center.
*/
export function projectOnGlobe(
	direction: { azimuth: number; elevation: number },
	rotation: number,
	view: GlobeView = DEFAULT_GLOBE_VIEW
): GlobePoint {
	const [x, y, z] = lightDirection(direction, rotation - view.azimuth)
	const tilt = globeTilt(view) * RADIANS
	return {
		x,
		y: -(y * Math.cos(tilt) - z * Math.sin(tilt)),
		front: z * Math.cos(tilt) + y * Math.sin(tilt) >= 0
	}
}

/** Degrees the globe turns for a drag of `dx`, so its front follows the pointer. */
export const dragDegrees = (dx: number, radius: number) => dx / radius / RADIANS
