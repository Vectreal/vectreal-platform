import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import { useApplySceneSettings } from './use-scene-settings'
import {
	DEFAULT_PRESET_ID,
	optimizationPresets
} from '../../constants/optimizations'
import {
	calculateAggregateReferencedBytes,
	executeOptimizationStateHydration,
	getSettingsFromAggregate,
	inferOptimizationPreset,
	toSceneSourcePayload,
	useSceneModel
} from '../../lib/domain/scene'
import { resolveBakedShadowSource } from '../../lib/domain/scene/client/baked-shadow-source'
import {
	currentSceneIdAtom,
	lastSavedSceneMetaAtom,
	sceneMetaAtom,
	sceneMetaInitialState
} from '../../lib/stores/publisher-config-store'
import {
	optimizationAtom,
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState
} from '../../lib/stores/scene-optimization-store'
import { bakedShadowSourceAtom } from '../../lib/stores/scene-settings-store'

import type { SceneManifestResponse } from '../../types/api'
import type { ModelSource, ModelState } from '@vctrl/hooks/use-load-model'

interface UseSceneSourceArgs {
	sceneId: null | string
	sceneManifest: SceneManifestResponse | null
}

/**
 * Puts the scene the route points at on screen.
 *
 * Two halves, deliberately separate. Saved settings, meta and optimization
 * state come straight from the route's manifest, so the viewer is configured
 * before any bytes arrive. The model itself is a load like any other, described
 * as a source and handed to the loader.
 */
export function useSceneSource({ sceneId, sceneManifest }: UseSceneSourceArgs) {
	const model = useModelContext()
	const applySceneSettings = useApplySceneSettings()
	const setSceneMeta = useSetAtom(sceneMetaAtom)
	const setLastSavedSceneMeta = useSetAtom(lastSavedSceneMetaAtom)
	const setCurrentSceneId = useSetAtom(currentSceneIdAtom)
	const setBakedShadowSource = useSetAtom(bakedShadowSourceAtom)
	const setOptimizationState = useSetAtom(optimizationAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)

	useEffect(() => {
		setCurrentSceneId(sceneId)
	}, [sceneId, setCurrentSceneId])

	// Saved state, applied from the manifest the route already fetched.
	useEffect(() => {
		if (!sceneManifest) return

		const settings = getSettingsFromAggregate(sceneManifest)
		if (settings) {
			applySceneSettings(settings)
		}

		const meta = sceneManifest.meta ?? sceneMetaInitialState
		setSceneMeta(meta)
		setLastSavedSceneMeta(meta)

		executeOptimizationStateHydration({
			aggregate: sceneManifest,
			calculateAggregateReferencedBytes,
			inferOptimizationPreset,
			setOptimizationState,
			setOptimizationRuntime,
			optimizationRuntimeInitialState,
			defaultOptimizations: optimizationPresets[DEFAULT_PRESET_ID]
		})
	}, [
		applySceneSettings,
		sceneManifest,
		setLastSavedSceneMeta,
		setOptimizationRuntime,
		setOptimizationState,
		setSceneMeta
	])

	const source = useMemo<ModelSource | null>(() => {
		if (!sceneId || !sceneManifest) return null

		return {
			kind: 'scene-data',
			sceneId,
			sceneData: toSceneSourcePayload(sceneManifest)
		}
	}, [sceneManifest, sceneId])

	const onSettled = useCallback(
		(state: ModelState) => {
			if (state.status !== 'ready') return

			// The persisted shadow bake is inlined in the scene's own assets, so it
			// only becomes available once the loader has resolved them.
			setBakedShadowSource(
				resolveBakedShadowSource(
					state.sceneData?.shadows,
					state.sceneData?.assetData
				) ?? null
			)

			toast.success(`Loaded scene: ${state.sceneData?.meta?.name || state.file.name}`)
		},
		[setBakedShadowSource]
	)

	useSceneModel(model, source, onSettled)

	const retry = useCallback(() => {
		if (source) void model.load(source)
	}, [model, source])

	return { retry }
}
