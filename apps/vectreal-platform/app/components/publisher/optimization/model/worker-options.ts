import { listEnabledGeometryKeys } from './optimization-catalog'

import type { WorkerOptimizationOptions } from '../../../../workers/optimization.worker.types'
import type { Optimizations } from '@vctrl/core'

/**
 * Builds the worker payload from the planned settings.
 *
 * Every enabled geometry entry passes through whole. `enabled` is the only
 * field removed, because it is UI state rather than a glTF-Transform option —
 * a key being present in the payload already means the step should run.
 *
 * Restating each step's fields here is what let the worker contract drift from
 * the option types it was supposed to mirror, so this deliberately never names
 * a single option.
 */
export function buildWorkerOptions(
	optimizations: Optimizations
): WorkerOptimizationOptions {
	const entries = listEnabledGeometryKeys(optimizations).map((key) => {
		const { enabled: _enabled, ...options } = optimizations[key]
		return [key, options] as const
	})

	return Object.fromEntries(entries) as WorkerOptimizationOptions
}
