import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router'
import { toast } from 'sonner'

import { useApplySceneSettings, useResetSceneState } from './use-scene-settings'
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
	lastSavedSceneIdAtom,
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
 *
 * Both halves key off the saved scene rather than off the manifest object. The
 * layout revalidates on tab focus and after every save, which produces a new
 * manifest for the same scene, and re-applying saved state then would overwrite
 * whatever the user has changed since.
 */
export function useSceneSource({ sceneId, sceneManifest }: UseSceneSourceArgs) {
	const model = useModelContext()
	const applySceneSettings = useApplySceneSettings()
	const resetSceneState = useResetSceneState()
	const setSceneMeta = useSetAtom(sceneMetaAtom)
	const setLastSavedSceneMeta = useSetAtom(lastSavedSceneMetaAtom)
	const setCurrentSceneId = useSetAtom(currentSceneIdAtom)
	const [lastSavedSceneId, setLastSavedSceneId] = useAtom(lastSavedSceneIdAtom)
	const setBakedShadowSource = useSetAtom(bakedShadowSourceAtom)
	const setOptimizationState = useSetAtom(optimizationAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const { search } = useLocation()

	const { reset: resetModel } = model
	const previousSceneIdRef = useRef<null | string>(sceneId)

	useEffect(() => {
		const previousSceneId = previousSceneIdRef.current
		previousSceneIdRef.current = sceneId

		setCurrentSceneId(sceneId)
		// The just-saved marker is consumed by the navigation it was written for.
		// Anything else means the route moved on and it no longer applies.
		setLastSavedSceneId((previous) =>
			previous === sceneId ? previous : null
		)

		// Leaving a scene for the base route is the one publisher transition that
		// unmounts nothing: /publisher and /publisher/:sceneId are one route. Without
		// this the previous scene stays on screen where an upload should be.
		if (previousSceneId && !sceneId) {
			resetModel()
			resetSceneState()
		}
	}, [
		resetModel,
		resetSceneState,
		sceneId,
		setCurrentSceneId,
		setLastSavedSceneId
	])

	// One saved scene, one identity. `settingsUpdatedAt` moves only when the
	// scene is genuinely re-saved.
	const savedSceneKey = sceneManifest
		? `${sceneId}:${sceneManifest.settingsUpdatedAt ?? ''}`
		: null
	const manifestRef = useRef(sceneManifest)
	manifestRef.current = sceneManifest

	// Saved state, applied from the manifest the route already fetched.
	useEffect(() => {
		const manifest = manifestRef.current
		if (!savedSceneKey || !manifest) return

		const settings = getSettingsFromAggregate(manifest)
		if (settings) {
			applySceneSettings(settings)
		}

		const meta = manifest.meta ?? sceneMetaInitialState
		setSceneMeta(meta)
		setLastSavedSceneMeta(meta)

		executeOptimizationStateHydration({
			aggregate: manifest,
			calculateAggregateReferencedBytes,
			inferOptimizationPreset,
			setOptimizationState,
			setOptimizationRuntime,
			optimizationRuntimeInitialState,
			defaultOptimizations: optimizationPresets[DEFAULT_PRESET_ID]
		})
	}, [
		applySceneSettings,
		savedSceneKey,
		setLastSavedSceneMeta,
		setOptimizationRuntime,
		setOptimizationState,
		setSceneMeta
	])

	// The first save navigates /publisher -> /publisher/<newId> while the model
	// that produced the scene is already on screen. Fetching and parsing it back
	// would tear down the viewer to rebuild what it is showing.
	const isJustSavedScene = Boolean(sceneId) && sceneId === lastSavedSceneId
	// A draft restore is the route asking for a different model entirely, so the
	// manifest must not race it.
	const isRestoringDraft =
		new URLSearchParams(search).get('restore_draft') === '1'

	const source = useMemo<ModelSource | null>(() => {
		if (!sceneId || !sceneManifest) return null
		if (isJustSavedScene || isRestoringDraft) return null

		return {
			kind: 'scene-data',
			sceneId,
			sceneData: toSceneSourcePayload(sceneManifest)
		}
	}, [isJustSavedScene, isRestoringDraft, sceneManifest, sceneId])

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
