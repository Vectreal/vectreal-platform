import { DEFAULT_PRESET_ID } from '../../../../constants/optimizations'

import type { SceneManifestResponse } from '../../../../types/api'
import type {
	OptimizationPreset,
	OptimizationState,
	SceneOptimizationRuntimeState
} from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

interface ManifestByteMetrics {
	sourcePackageBytes: null | number
	textureBytes: null | number
}

interface ExecuteOptimizationStateHydrationParams {
	manifest: SceneManifestResponse | null
	calculateManifestReferencedBytes: (
		manifest: SceneManifestResponse | null
	) => ManifestByteMetrics
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
	manifest,
	calculateManifestReferencedBytes,
	inferOptimizationPreset,
	setOptimizationState,
	setOptimizationRuntime,
	optimizationRuntimeInitialState,
	defaultOptimizations
}: ExecuteOptimizationStateHydrationParams) => {
	const persistedOptimizationSettings = manifest?.stats?.optimizationSettings
	const latestSceneStats = manifest?.stats ?? null
	const { sourcePackageBytes, textureBytes } =
		calculateManifestReferencedBytes(manifest)

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
