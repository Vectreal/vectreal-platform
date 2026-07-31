import { useAtom } from 'jotai/react'
import { useCallback, useMemo } from 'react'

import { applyOptimizationChange } from './model/optimization-settings'
import { inferOptimizationPreset } from '../../../lib/domain/scene/client/optimization-inference'
import { optimizationAtom } from '../../../lib/stores/scene-optimization-store'

import type { OptimizationKey } from './model'
import type { PresetId } from '../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

/**
 * Read/write access to the planned optimization settings.
 *
 * Every write re-infers which preset the result corresponds to, so the panel
 * flips to "Custom" the moment the settings stop matching a preset instead of
 * continuing to highlight the card the user started from.
 */
export function useOptimizationSettings() {
	const [{ optimizations, optimizationPreset }, setState] =
		useAtom(optimizationAtom)

	const commit = useCallback(
		(next: Optimizations) =>
			setState((prev) => ({
				...prev,
				optimizations: next,
				optimizationPreset: inferOptimizationPreset(next)
			})),
		[setState]
	)

	const update = useCallback(
		<Key extends OptimizationKey>(
			key: Key,
			updates: Partial<Optimizations[Key]>
		) =>
			setState((prev) => {
				const next = applyOptimizationChange(prev.optimizations, key, updates)
				return {
					...prev,
					optimizations: next,
					optimizationPreset: inferOptimizationPreset(next)
				}
			}),
		[setState]
	)

	const selectPreset = useCallback(
		(preset: PresetId, presetOptimizations: Optimizations) =>
			setState((prev) => ({
				...prev,
				optimizationPreset: preset,
				optimizations: presetOptimizations
			})),
		[setState]
	)

	return useMemo(
		() => ({
			optimizations,
			optimizationPreset,
			update,
			commit,
			selectPreset
		}),
		[optimizations, optimizationPreset, update, commit, selectPreset]
	)
}
