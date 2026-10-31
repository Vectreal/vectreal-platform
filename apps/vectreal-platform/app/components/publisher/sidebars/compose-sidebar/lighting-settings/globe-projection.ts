import { lightDirection } from '@vctrl/core'

const RADIANS = Math.PI / 180

/** How far the globe is seen from above, so its horizon reads as a ring. */
export const GLOBE_TILT = 22

/** A direction as the globe draws it, in radii from its center, y down. */
export interface GlobePoint {
	x: number
	y: number
	/** Whether it is on the half of the globe that faces the viewer. */
	front: boolean
}

/*
  The globe is seen from the model's front (+Z), lifted by `GLOBE_TILT`, the
  way the viewer's camera usually opens. A direction's azimuth is turned by
  the environment's rotation exactly as the scene turns it.
*/
export function projectOnGlobe(
	direction: { azimuth: number; elevation: number },
	rotation: number
): GlobePoint {
	const [x, y, z] = lightDirection(direction, rotation)
	const tilt = GLOBE_TILT * RADIANS
	return {
		x,
		y: -(y * Math.cos(tilt) - z * Math.sin(tilt)),
		front: z * Math.cos(tilt) + y * Math.sin(tilt) >= 0
	}
}

/** Degrees the globe turns for a drag of `dx`, so its front follows the pointer. */
export const dragDegrees = (dx: number, radius: number) => dx / radius / RADIANS
