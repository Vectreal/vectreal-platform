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
 * `SceneSettingsParser.parseSettingsData` normalizes only `camera`,
 * `interactions` and `hotspots`; everything else on the settings object is
 * written to its column verbatim from whatever the client posted. That is fine
 * for a shape nothing branches on, and not fine here, because
 * `shouldShowInfoPopover` reads this field to decide what a published scene
 * renders.
 *
 * Returns `undefined` for anything that is not an object, and drops a
 * `showInfoPopover` that is not a boolean rather than coercing it: `"false"` is
 * a string, and coercion would turn the author's off into an on.
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

	const { showInfoPopover } = presentation as ScenePresentationSettings

	if (typeof showInfoPopover !== 'boolean') {
		return undefined
	}

	return { showInfoPopover }
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
