import { optimizationsMatch } from './optimization-inference'
import {
	DEFAULT_PRESET_ID,
	originalPreset
} from '../../../../constants/optimizations'

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
	/**
	 * The optimizer already holds this scene's source: a scene this tab just
	 * saved, whose upload is still loaded. What the source and the document
	 * embody is then known here, not inferred from the saved settings.
	 */
	isSourceLoaded?: boolean
}

export const executeOptimizationStateHydration = ({
	manifest,
	calculateManifestReferencedBytes,
	inferOptimizationPreset,
	setOptimizationState,
	setOptimizationRuntime,
	optimizationRuntimeInitialState,
	defaultOptimizations,
	isSourceLoaded = false
}: ExecuteOptimizationStateHydrationParams) => {
	const persistedOptimizationSettings = manifest?.stats?.optimizationSettings
	const latestSceneStats = manifest?.stats ?? null
	const { sourcePackageBytes, textureBytes } =
		calculateManifestReferencedBytes(manifest)

	if (!persistedOptimizationSettings) {
		setOptimizationState((prev) => ({
			...prev,
			optimizationPreset: DEFAULT_PRESET_ID,
			optimizations: defaultOptimizations,
			...(isSourceLoaded
				? {}
				: { sourceSettings: originalPreset, derivedFrom: originalPreset })
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

	// The saved document is the only source a reopened scene has, and it
	// already embodies the settings it was saved with: a save stores the
	// settings that produced its document. Only a scene saved as the original
	// is the untouched upload.
	//
	// Scenes saved before that rule may carry settings no pass applied. They
	// read as a saved version, which costs nothing: their document is lossless,
	// and they keep the publish-time Draco they had.
	const sourceSettings = optimizationsMatch(
		persistedOptimizationSettings,
		originalPreset
	)
		? originalPreset
		: persistedOptimizationSettings

	setOptimizationState((prev) => ({
		...prev,
		optimizationPreset: inferredPreset,
		optimizations: persistedOptimizationSettings,
		...(isSourceLoaded ? {} : { sourceSettings, derivedFrom: sourceSettings })
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
