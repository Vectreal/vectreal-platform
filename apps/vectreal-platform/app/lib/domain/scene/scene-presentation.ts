import type { ScenePresentationSettings } from '@vctrl/core'

/**
 * The rules for `SceneSettings.presentation`, owned in one place because the
 * two halves that need them sit on opposite sides of the wire: the save path
 * decides what may be written, and the embed surface decides what to draw. A
 * disagreement between them is a scene that saves one thing and renders
 * another.
 */

/**
 * Narrows an untrusted `presentation` blob to the fields this app understands.
 *
 * `parseSettingsData` (`scene-settings-payload.parser.server.ts`) normalizes only `camera`,
 * `interactions` and `hotspots`; everything else on the settings object is
 * written to its column verbatim from whatever the client posted. That is fine
 * for a shape nothing branches on, and not fine here, because
 * `shouldShowInfoPopover` reads this field to decide what a published scene
 * renders.
 *
 * Returns `undefined` for anything that is not an object or carries no field
 * it understands, and drops a field of the wrong type rather than coercing
 * it: `"false"` is a string, and coercion would turn the author's off into an
 * on. Alt text is trimmed, and left out when nothing is left of it.
 *
 * Dropped means "not written", not "cleared". Drizzle omits `undefined` from
 * the SET clause, so a scene that already stores `false` keeps it when a
 * request arrives carrying junk. That is the safe direction - garbage cannot
 * silently switch a popover back on - and it is unreachable from the
 * publisher, which always posts a boolean.
 */
export function normalizePresentationSettings(
	presentation: unknown
): ScenePresentationSettings | undefined {
	if (
		!presentation ||
		typeof presentation !== 'object' ||
		Array.isArray(presentation)
	) {
		return undefined
	}

	const {
		showInfoPopover,
		showSceneViewReturn,
		showLoadingThumbnail,
		compressTexturesForGpu,
		altText,
		showFullscreenButton
	} = presentation as ScenePresentationSettings
	const trimmedAltText = typeof altText === 'string' ? altText.trim() : ''
	const normalized: ScenePresentationSettings = {
		...(typeof showInfoPopover === 'boolean' ? { showInfoPopover } : {}),
		...(typeof showSceneViewReturn === 'boolean'
			? { showSceneViewReturn }
			: {}),
		...(typeof showLoadingThumbnail === 'boolean'
			? { showLoadingThumbnail }
			: {}),
		...(typeof compressTexturesForGpu === 'boolean'
			? { compressTexturesForGpu }
			: {}),
		...(trimmedAltText ? { altText: trimmedAltText } : {}),
		...(typeof showFullscreenButton === 'boolean'
			? { showFullscreenButton }
			: {})
	}

	return Object.keys(normalized).length > 0 ? normalized : undefined
}

/**
 * Whether a published scene draws the viewer's info affordance.
 *
 * Absent means shown, which is why this is not a truthiness check. Every scene
 * saved before the `presentation` column existed reads back `undefined` here,
 * and those scenes already draw the popover; only an author who explicitly
 * switched it off gets `false`.
 */
export function shouldShowInfoPopover(
	presentation: ScenePresentationSettings | undefined
): boolean {
	return presentation?.showInfoPopover !== false
}

/**
 * The viewer's accessible name: the author's alt text, or else the scene's
 * name and description, so a scene saved without alt text is still announced
 * as something.
 */
export function resolveSceneAltText(
	presentation: ScenePresentationSettings | undefined | null,
	meta: { name?: string | null; description?: string | null } | undefined
): string | undefined {
	const altText = presentation?.altText?.trim()
	if (altText) return altText
	const fallback = [meta?.name?.trim(), meta?.description?.trim()]
		.filter(Boolean)
		.join('. ')
	return fallback || undefined
}

/**
 * Whether a published scene draws the viewer's way back from a hotspot's
 * camera. Absent means shown, for the same reason as `shouldShowInfoPopover`:
 * every scene saved before the field existed draws it.
 */
export function shouldShowSceneViewReturn(
	presentation: ScenePresentationSettings | undefined | null
): boolean {
	return presentation?.showSceneViewReturn !== false
}

/**
 * Whether a published scene draws the viewer's full screen button. Absent
 * means not shown; see `ScenePresentationSettings.showFullscreenButton`.
 */
export function shouldShowFullscreenButton(
	presentation: ScenePresentationSettings | undefined | null
): boolean {
	return presentation?.showFullscreenButton === true
}

/**
 * Whether an embed shows the scene's saved thumbnail while it loads. Absent
 * means not shown; see `ScenePresentationSettings.showLoadingThumbnail`.
 */
export function shouldShowLoadingThumbnail(
	presentation: ScenePresentationSettings | undefined | null
): boolean {
	return presentation?.showLoadingThumbnail === true
}

/**
 * Whether publishing encodes textures as KTX2. Absent means on, except for a
 * scene on the `original` preset; see
 * `ScenePresentationSettings.compressTexturesForGpu`.
 */
export function shouldCompressTexturesForGpu(
	presentation: ScenePresentationSettings | undefined | null,
	{ isOriginalPreset }: { isOriginalPreset: boolean }
): boolean {
	return presentation?.compressTexturesForGpu ?? !isOriginalPreset
}

/**
 * Records an author's texture compression choice, as a deviation from the
 * default only. Choosing what the default already says removes the field, so
 * switching it off and on again leaves the scene as it was saved rather than
 * dirty, and the default keeps following the preset.
 */
export function withCompressTexturesForGpu(
	presentation: ScenePresentationSettings,
	compressTexturesForGpu: boolean,
	{ isOriginalPreset }: { isOriginalPreset: boolean }
): ScenePresentationSettings {
	const { compressTexturesForGpu: _previous, ...rest } = presentation
	return compressTexturesForGpu === !isOriginalPreset
		? rest
		: { ...rest, compressTexturesForGpu }
}
