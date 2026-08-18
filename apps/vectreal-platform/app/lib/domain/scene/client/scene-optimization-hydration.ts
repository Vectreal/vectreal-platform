import { DEFAULT_PRESET_ID } from '../../../../constants/optimizations'

import type { SceneManifestResponse } from '../../../../types/api'
import type {
	OptimizationPreset,
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

interface AggregateByteMetrics {
	sourcePackageBytes: null | number
	textureBytes: null | number
}

interface ExecuteOptimizationStateHydrationParams {
	aggregate: SceneManifestResponse | null
	calculateAggregateReferencedBytes: (
		aggregate: SceneManifestResponse | null
	) => AggregateByteMetrics
	inferOptimizationPreset: (optimizations: Optimizations) => OptimizationPreset
	setOptimizationState: (
		updater: (prev: OptimizationState) => OptimizationState
	) => void
	setOptimizationRuntime: (
		next:
			| SceneOptimizationRuntimeState
			| ((prev: SceneOptimizationRuntimeState) => SceneOptimizationRuntimeState)
	) => void
	optimizationRuntimeInitialState: SceneOptimizationRuntimeState
	defaultOptimizations: Optimizations
}

export const executeOptimizationStateHydration = ({
	aggregate,
	calculateAggregateReferencedBytes,
	inferOptimizationPreset,
	setOptimizationState,
	setOptimizationRuntime,
	optimizationRuntimeInitialState,
	defaultOptimizations
}: ExecuteOptimizationStateHydrationParams) => {
	const persistedOptimizationSettings = aggregate?.stats?.optimizationSettings
	const latestSceneStats = aggregate?.stats ?? null
	const { sourcePackageBytes, textureBytes } =
		calculateAggregateReferencedBytes(aggregate)

	if (!persistedOptimizationSettings) {
		setOptimizationState((prev) => ({
			...prev,
			optimizationPreset: DEFAULT_PRESET_ID,
			optimizations: defaultOptimizations
		}))

		setOptimizationRuntime({
			...optimizationRuntimeInitialState,
			isSceneSizeLoading: false,
			latestSceneStats,
			clientSceneBytes: sourcePackageBytes,
			clientTextureBytes: textureBytes
		})
		return
	}

	const inferredPreset = inferOptimizationPreset(persistedOptimizationSettings)

	setOptimizationState((prev) => ({
		...prev,
		optimizationPreset: inferredPreset,
		optimizations: persistedOptimizationSettings
	}))

	setOptimizationRuntime((prev) => ({
		...prev,
		isPending: false,
		isSceneSizeLoading: false,
		optimizedSceneBytes: null,
		optimizedTextureBytes: null,
		clientSceneBytes: sourcePackageBytes,
		clientTextureBytes: textureBytes,
		latestSceneStats
	}))
}
