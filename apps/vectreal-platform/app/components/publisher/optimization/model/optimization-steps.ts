import {
	getOptimizationDefinition,
	listEnabledGeometryKeys
} from './optimization-catalog'

import type { GeometryOptimizationKey } from '../../../../workers/optimization.worker.types'
import type { Optimizations } from '@vctrl/core'

/** Reloading the source scene and measuring baselines, before any step runs. */
export const PREPARE_STEP = 'Preparing scene'
/** The worker's final export plus the reload into the viewer, after every step. */
export const SYNC_STEP = 'Syncing to viewer'

export interface OptimizationStepPlan {
	geometryKeys: GeometryOptimizationKey[]
	hasTextureStep: boolean
	/** Every checklist row, in the order they will run. */
	allSteps: string[]
}

/**
 * Works out the checklist up front so the panel can render the full list while
 * the first (slow) step is still running, rather than growing a row at a time.
 */
export function planOptimizationSteps(
	optimizations: Optimizations
): OptimizationStepPlan {
	const geometryKeys = listEnabledGeometryKeys(optimizations)
	const hasTextureStep = Boolean(optimizations.texture?.enabled)

	return {
		geometryKeys,
		hasTextureStep,
		allSteps: [
			PREPARE_STEP,
			...geometryKeys.map((key) => getOptimizationDefinition(key).stepLabel),
			...(hasTextureStep
				? [getOptimizationDefinition('texture').stepLabel]
				: []),
			SYNC_STEP
		]
	}
}
