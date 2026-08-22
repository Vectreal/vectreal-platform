import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { useApplySceneSettings, useResetSceneState } from './use-scene-settings'
import {
	DEFAULT_PRESET_ID,
	optimizationPresets
} from '../../constants/optimizations'
import {
	calculateManifestReferencedBytes,
	executeOptimizationStateHydration,
	getSettingsFromManifest,
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
	/** The scene the URL points at, whether or not it could be read. */
	routeSceneId: null | string
	/**
	 * The scene actually open in the publisher: a route id the loader shipped a
	 * manifest for. An id alone is not one, since a signed-out or expired
	 * session leaves the id in the URL with nothing behind it.
	 */
	openSceneId: null | string
	sceneManifest: SceneManifestResponse | null
	/** True while a signed-in draft is being read back from IndexedDB. */
	isRestoringDraft: boolean
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
export function useSceneSource({
	routeSceneId,
	openSceneId,
	sceneManifest,
	isRestoringDraft
}: UseSceneSourceArgs) {
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
	const { reset: resetModel } = model
	// Keyed on the URL, not on the manifest. Leaving a scene is something the
	// user did; a manifest that stops arriving is a session going stale, and
	// tearing the open scene down for that would lose their work on a blip.
	const previousRouteSceneIdRef = useRef<null | string>(routeSceneId)

	useEffect(() => {
		const previousRouteSceneId = previousRouteSceneIdRef.current
		previousRouteSceneIdRef.current = routeSceneId

		setCurrentSceneId(openSceneId)
		// The just-saved marker is consumed by the navigation it was written for.
		// Anything else means the route moved on and it no longer applies.
		setLastSavedSceneId((previous) =>
			previous === openSceneId ? previous : null
		)

		// Leaving a scene for the base route is the one publisher transition that
		// unmounts nothing: /publisher and /publisher/:sceneId are one route. Without
		// this the previous scene stays on screen where an upload should be.
		if (previousRouteSceneId && !routeSceneId) {
			resetModel()
			resetSceneState()
		}
	}, [
		openSceneId,
		resetModel,
		resetSceneState,
		routeSceneId,
		setCurrentSceneId,
		setLastSavedSceneId
	])

	// Keyed on the scene, not on the manifest object and not on its version. The
	// layout revalidates on tab focus and after every save, and a save publishes
	// its own baselines, so re-applying here would overwrite whatever the user
	// changed in the meantime.
	const savedSceneKey = sceneManifest ? openSceneId : null
	const manifestRef = useRef(sceneManifest)
	manifestRef.current = sceneManifest

	// Saved state, applied from the manifest the route already fetched.
	useEffect(() => {
		const manifest = manifestRef.current
		if (!savedSceneKey || !manifest) return

		// Applied even when the manifest carries no settings: the save baseline is
		// written here, and a scene left without one reads as never saved, which
		// is what an upload is, not what an opened scene is.
		applySceneSettings(getSettingsFromManifest(manifest) ?? {})

		const meta = manifest.meta ?? sceneMetaInitialState
		setSceneMeta(meta)
		setLastSavedSceneMeta(meta)

		executeOptimizationStateHydration({
			manifest,
			calculateManifestReferencedBytes,
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
	const isJustSavedScene =
		Boolean(openSceneId) && openSceneId === lastSavedSceneId

	const source = useMemo<ModelSource | null>(() => {
		if (!openSceneId || !sceneManifest) return null
		// A draft restore is the route asking for a different model entirely.
		if (isJustSavedScene || isRestoringDraft) return null

		return {
			kind: 'scene-data',
			sceneId: openSceneId,
			sceneData: toSceneSourcePayload(sceneManifest)
		}
	}, [isJustSavedScene, isRestoringDraft, openSceneId, sceneManifest])

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

			toast.success(
				`Loaded scene: ${state.sceneData?.meta?.name || state.file.name}`
			)
		},
		[setBakedShadowSource]
	)

	useSceneModel(model, source, onSettled)

	const retry = useCallback(() => {
		if (source) void model.load(source)
	}, [model, source])

	return { retry }
}
