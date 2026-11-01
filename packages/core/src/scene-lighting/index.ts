export {
	aimLegacyLight,
	aimLight,
	LEGACY_LIGHTING_DEFAULTS,
	resolveLighting,
	type ResolvedLighting,
	type ResolvedSceneLight
} from './resolve-lighting'
export {
	BAKED_LIGHTMAP_USER_DATA,
	bakedLightsSignature,
	LIGHTMAP_EXTENSION,
	type BakedLightmapInfo
} from './baked-lights'
export { lightDirection, litLights } from './light-direction'
export { toLegacyLighting } from './to-legacy-lighting'
export { ENVIRONMENT_LIGHTS, type EnvironmentLight } from './environment-lights'
export {
	DEFAULT_LIGHTING_SETUP,
	LIGHTING_SETUPS,
	type LightingSetup,
	type LightingSetupId
} from './lighting-setups'
