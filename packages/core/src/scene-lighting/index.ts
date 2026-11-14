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
export {
	applyBakedLights,
	bakedLightsShaderMatchesThree,
	drawnLightsSignature,
	patchBakedLightsShader
} from './baked-lights-material'
export { lightDirection, litLights } from './light-direction'
export {
	computeBakeSignature,
	GROUND_BAKE_SIGNATURE_INPUTS,
	groundBakeSignatureOptions,
	isGroundBakeMissing,
	isPersistedBakeValid,
	type BakeSignatureOptions
} from './ground-bake-signature'
export { toLegacyLighting } from './to-legacy-lighting'
export {
	ENVIRONMENT_IRRADIANCE,
	ENVIRONMENT_LIGHTS,
	type EnvironmentLight
} from './environment-lights'
export { environmentIrradiance } from './environment-irradiance'
export {
	DEFAULT_LIGHTING_SETUP,
	LIGHTING_SETUPS,
	type LightingSetup,
	type LightingSetupId
} from './lighting-setups'
