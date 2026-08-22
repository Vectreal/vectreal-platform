/**
 * Deciding whether a scene's settings differ from the row already stored.
 *
 * The save path short-circuits on `unchanged` when nothing here has moved, and
 * returns before it writes anything. That makes this function the gate every
 * edit has to pass, and a field missing from it is an edit the user makes, sees
 * confirmed, and loses.
 *
 * It used to name the compared fields one by one while the write side spread
 * the whole settings object into the row. The two drifted, as that arrangement
 * always will: `hotspots` was missing, and so was `normalization`. So this
 * reads the fields off the settings object instead, through the same
 * `columnBackedSceneSettings` the write spreads into the row, and a field added
 * to `SceneSettings` is compared from the moment it exists.
 *
 * A field with no column compares unequal forever, because the row can never
 * carry it back. That costs a redundant write per save, which is the direction
 * to fail in: the alternative is a field that persists nowhere and reports
 * success, which is what `occlusionEnabled` did before it got a column.
 */

import { haveHotspotsChanged } from './scene-hotspot-comparison'

import type { HotspotDefinition, SceneSettings } from '@vctrl/core'

/**
 * The settings the `scene_settings` row itself carries. `hotspots` is the one
 * field with no column of its own: it lives in the `scene_hotspots` table, so
 * the write path stores it through `replaceHotspots` and the comparison holds
 * it against the separately loaded list.
 */
export const columnBackedSceneSettings = (
	settings: SceneSettings
): Omit<SceneSettings, 'hotspots'> => {
	const { hotspots: _hotspots, ...columnSettings } = settings

	return columnSettings
}

/**
 * Absent and null both mean "not set": the client omits the field, the column
 * holds null. Without folding them together every scene that leaves a setting
 * untouched would report as changed on every save.
 */
const sameJson = (a: unknown, b: unknown): boolean =>
	JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export const haveSceneSettingsChanged = (
	current: SceneSettings,
	existing: Readonly<Record<string, unknown>>,
	existingHotspots: readonly HotspotDefinition[]
): boolean => {
	if (haveHotspotsChanged(current.hotspots, existingHotspots)) return true

	return Object.entries(columnBackedSceneSettings(current)).some(
		([field, value]) => !sameJson(value, existing[field])
	)
}
