import { ENVIRONMENT_LIGHTS, type EnvironmentLight } from './environment-lights'

import type {
	EnvironmentKey,
	LightingSettings,
	SceneLight,
	SceneLightRole
} from '../types'

/** The setups the Lighting tool offers. */
export type LightingSetupId =
	| 'soft-studio'
	| 'product'
	| 'dramatic'
	| 'overhead'
	| 'daylight'
	| 'golden-hour'
	| 'overcast'
	| 'night'

export interface LightingSetup {
	id: LightingSetupId
	label: string
	lighting: LightingSettings
}

/** The regions `map` has, by index: a region it lacks does not compile. */
type RegionIndex<M extends EnvironmentKey> = Exclude<
	Partial<(typeof ENVIRONMENT_LIGHTS)[M]>['length'],
	(typeof ENVIRONMENT_LIGHTS)[M]['length']
>

/**
 * A light standing where `map` holds its `region`-th brightest region, so its
 * highlight on a glossy surface sits on the reflection of the map's own light
 * and its shadow falls the way that light would cast it. `elevation`
 * overrides the region's only where a setup needs the light higher than the
 * map has one, as a product shot needs its fill off the floor.
 */
function onRegion<M extends EnvironmentKey>(
	map: M,
	region: RegionIndex<M> & number,
	light: Omit<SceneLight, 'azimuth'> & { role: SceneLightRole }
): SceneLight {
	const regions: readonly EnvironmentLight[] = ENVIRONMENT_LIGHTS[map]
	const { azimuth, elevation } = regions[region]
	return { azimuth, elevation, ...light }
}

/**
 * The lighting setups, each a whole look: a map, up to three lights placed on
 * the map's own bright regions, their sizes and the balance between them.
 * Turning a setup (`environment.rotation`) turns the map and every light
 * together, so they stay aligned.
 */
export const LIGHTING_SETUPS: readonly LightingSetup[] = [
	{
		id: 'soft-studio',
		label: 'Soft studio',
		lighting: {
			environment: { map: 'studio-soft' },
			lights: [
				onRegion('studio-soft', 0, { role: 'key', size: 40, intensity: 0.8 }),
				onRegion('studio-soft', 1, {
					role: 'fill',
					elevation: 30,
					size: 60,
					intensity: 0.25
				})
			],
			ground: { enabled: true },
			background: { type: 'none' }
		}
	},
	{
		id: 'product',
		label: 'Product',
		lighting: {
			environment: { map: 'studio-key' },
			lights: [
				onRegion('studio-key', 0, { role: 'key', size: 18, intensity: 0.9 }),
				onRegion('studio-key', 1, {
					role: 'fill',
					elevation: 20,
					size: 40,
					intensity: 0.3
				}),
				onRegion('studio-key', 2, {
					role: 'rim',
					elevation: 30,
					size: 12,
					intensity: 0.6
				})
			],
			ground: { enabled: true },
			background: { type: 'none' }
		}
	},
	{
		id: 'dramatic',
		label: 'Dramatic',
		lighting: {
			// Turned so the map's top softbox lights the model from the side.
			// Strengths are relative to the environment, so a dim map with a
			// strong key is what makes the contrast.
			environment: { map: 'studio-key', intensity: 0.35, rotation: 70 },
			lights: [
				onRegion('studio-key', 0, { role: 'key', size: 6, intensity: 4 }),
				onRegion('studio-key', 2, {
					role: 'rim',
					elevation: 25,
					size: 8,
					intensity: 2.5
				})
			],
			ground: { enabled: true },
			background: { type: 'none' }
		}
	},
	{
		id: 'overhead',
		label: 'Overhead',
		lighting: {
			environment: { map: 'studio-natural' },
			lights: [
				onRegion('studio-natural', 0, {
					role: 'key',
					elevation: 80,
					size: 25,
					intensity: 0.8
				})
			],
			ground: { enabled: true },
			background: { type: 'none' }
		}
	},
	{
		id: 'daylight',
		label: 'Daylight',
		lighting: {
			environment: { map: 'outdoor-noon' },
			lights: [
				onRegion('outdoor-noon', 0, {
					role: 'key',
					size: 2,
					intensity: 1,
					color: '#fff6e8'
				})
			],
			ground: { enabled: true },
			background: { type: 'none' }
		}
	},
	{
		id: 'golden-hour',
		label: 'Golden hour',
		lighting: {
			environment: { map: 'outdoor-golden-hour' },
			lights: [
				onRegion('outdoor-golden-hour', 0, {
					role: 'key',
					elevation: 10,
					size: 3,
					intensity: 1.2,
					color: '#ffb46b'
				}),
				{
					role: 'fill',
					// Opposite the sun, from the cool sky it lights.
					azimuth: ENVIRONMENT_LIGHTS['outdoor-golden-hour'][0].azimuth - 180,
					elevation: 35,
					size: 60,
					intensity: 0.25,
					color: '#a8c0ff'
				}
			],
			ground: { enabled: true },
			background: { type: 'none' }
		}
	},
	{
		id: 'overcast',
		label: 'Overcast',
		lighting: {
			environment: { map: 'outdoor-overcast' },
			lights: [],
			ground: { enabled: true },
			background: { type: 'none' }
		}
	},
	{
		id: 'night',
		label: 'Night',
		lighting: {
			environment: { map: 'night-city', intensity: 0.5 },
			lights: [
				onRegion('night-city', 0, {
					role: 'key',
					elevation: 25,
					size: 6,
					intensity: 2.2,
					color: '#b4c8ff'
				}),
				onRegion('night-city', 1, {
					role: 'rim',
					elevation: 20,
					size: 8,
					intensity: 1.8,
					color: '#ffb070'
				})
			],
			ground: { enabled: true },
			background: { type: 'none' }
		}
	}
]

/** The setup a new scene starts from. */
export const DEFAULT_LIGHTING_SETUP: LightingSetupId = 'soft-studio'
