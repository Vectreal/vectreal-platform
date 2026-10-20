import {
	defaultBoundsOptions,
	defaultControlsOptions,
	defaultEnvOptions,
	defaultPresentationOptions,
	normalizeShadowOptions
} from '../../../constants/viewer-defaults'

import type { SceneSettings } from '@vctrl/core'
import type { UpdateSceneSettingsInput } from '@vctrl/sdk'

/**
 * A scene's settings with `patch` applied: each section it names replaces the
 * stored one, and every other section stays as stored.
 *
 * A sent section is filled over that section's defaults, so it is stored
 * whole, as a publisher save stores it. Defaults fill a section only when it
 * is absent (`withSceneSettingsDefaults`), so a partial one stored as sent
 * would hand the keys it leaves out to the viewer's own defaults, which
 * differ, and an empty presentation would normalize to nothing, which the
 * save leaves as stored.
 *
 * Two values stay the server's, whatever the patch says. The shadow bake
 * names an asset, which a caller could point at another scene's file; the
 * stored one stays, as a publisher save keeps it, and the viewer bakes live
 * when its signature no longer matches the shadow inputs.
 * `presentation.compressTexturesForGpu` is recorded by the publisher against
 * the optimization preset, which the server does not decide.
 *
 * The result is unchecked; it goes through `parseSettingsData` like any save.
 */
export function applySceneSettingsPatch(
	stored: SceneSettings,
	patch: UpdateSceneSettingsInput
): SceneSettings {
	const merged = { ...stored }

	if (patch.bounds) merged.bounds = { ...defaultBoundsOptions, ...patch.bounds }
	if (patch.controls) {
		merged.controls = { ...defaultControlsOptions, ...patch.controls }
	}
	if (patch.environment) {
		merged.environment = { ...defaultEnvOptions, ...patch.environment }
	}
	if (patch.shadows) {
		const { baked: _sent, ...sent } = patch.shadows
		const shadows = normalizeShadowOptions(sent)
		const baked = stored.shadows?.baked
		merged.shadows = baked ? { ...shadows, baked } : shadows
	}
	if (patch.presentation) {
		const { compressTexturesForGpu: _sent, ...sent } = patch.presentation
		const compress = stored.presentation?.compressTexturesForGpu
		merged.presentation = {
			...defaultPresentationOptions,
			...sent,
			...(compress === undefined ? {} : { compressTexturesForGpu: compress })
		}
	}
	return merged
}
