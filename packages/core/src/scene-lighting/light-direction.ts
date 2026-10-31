import type { ResolvedLighting, ResolvedSceneLight } from './resolve-lighting'

const RADIANS = Math.PI / 180

/**
 * Unit vector from the model toward a light: `azimuth` around the vertical
 * axis (0 toward +Z, 90 toward +X), turned by the environment's rotation so
 * the lights stay where the environment's own bright regions are.
 *
 * Adding the rotation to the azimuth matches three.js: it looks the map up
 * with the transpose of `environmentRotation`, so what the map holds at
 * azimuth `a` is drawn at `a + rotation`.
 */
export function lightDirection(
	light: Pick<ResolvedSceneLight, 'azimuth' | 'elevation'>,
	rotation: number
): [number, number, number] {
	const azimuth = (light.azimuth + rotation) * RADIANS
	const elevation = light.elevation * RADIANS
	return [
		Math.sin(azimuth) * Math.cos(elevation),
		Math.sin(elevation),
		Math.cos(azimuth) * Math.cos(elevation)
	]
}

/** The lights that contribute anything. */
export const litLights = (lighting: Pick<ResolvedLighting, 'lights'>) =>
	lighting.lights.filter((light) => light.enabled && light.intensity > 0)
