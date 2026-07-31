import { optimizationPresets } from '../../../../constants/optimizations'

import type {
	OptimizationPreset,
	PresetId
} from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

/**
 * Fields that exist on persisted settings but say nothing about behavior.
 *
 * `name` used to duplicate the object key. It is gone from the type, but rows
 * written before that still carry it and must not be the reason a scene stops
 * matching its preset.
 */
const IGNORED_FIELDS = new Set(['name'])

function isEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((item, i) => isEqual(item, b[i]))
	}
	return false
}

/**
 * Compares one optimization entry against a preset's, over the union of both
 * sides' fields so an extra option on the candidate counts as a difference.
 * A field that is absent on one side and `undefined` on the other is a match.
 */
function entryMatches(candidate: unknown, preset: unknown): boolean {
	const candidateFields = (candidate ?? {}) as Record<string, unknown>
	const presetFields = (preset ?? {}) as Record<string, unknown>
	const fields = new Set([
		...Object.keys(candidateFields),
		...Object.keys(presetFields)
	])

	for (const field of fields) {
		if (IGNORED_FIELDS.has(field)) continue
		if (!isEqual(candidateFields[field], presetFields[field])) return false
	}

	return true
}

/**
 * Works out which preset a set of optimizations corresponds to, or `custom`
 * when it corresponds to none.
 *
 * Returning `custom` is the point. The previous implementation compared with
 * `JSON.stringify` (so key order alone could break it) and fell back to the
 * middle preset, which meant an edited advanced panel still showed a preset
 * card as selected.
 */
export const inferOptimizationPreset = (
	optimizations: Optimizations
): OptimizationPreset => {
	const entries = Object.entries(optimizationPresets) as Array<
		[PresetId, Optimizations]
	>

	const match = entries.find(([, preset]) => {
		// The union of both sides' keys, so an optimization the candidate is
		// missing entirely and one it has spare are both differences. Settings
		// saved before a step existed hit the first case.
		const keys = new Set([
			...Object.keys(optimizations),
			...Object.keys(preset)
		]) as Set<keyof Optimizations>

		return [...keys].every((key) =>
			entryMatches(optimizations[key], preset[key])
		)
	})

	return match?.[0] ?? 'custom'
}
