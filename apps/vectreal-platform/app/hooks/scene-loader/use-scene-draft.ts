import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { usePrepareGltfDocument } from './use-scene-document-export'
import { useApplySceneSettings } from './use-scene-settings'
import {
	inferOptimizationPreset,
	persistPendingSceneDraftOrchestrator,
	serializeSceneAssetData
} from '../../lib/domain/scene'
import {
	loadPendingSceneDraft,
	saveOriginalSceneModel,
	setTabDraftId
} from '../../lib/persistence/pending-scene-idb'
import {
	lastSavedSceneMetaAtom,
	sceneMetaAtom
} from '../../lib/stores/publisher-config-store'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../lib/stores/scene-optimization-store'
import { sceneViewerSettingsAtom } from '../../lib/stores/scene-settings-store'

import type { ServerSceneData } from '@vctrl/core'
import type { ModelFile } from '@vctrl/hooks/use-load-model'

/**
 * The publisher's IndexedDB side: the draft that survives an auth redirect, and
 * the pre-optimization snapshot every re-optimization starts from.
 *
 * All three operations are plain functions called from the moment they belong
 * to - a save button, a finished upload - except the restore, which is a route
 * state (`?restore_draft=1`) and so runs once when that route is entered.
 */
export function useSceneDraft() {
	const { file } = useModelContext()
	const prepareGltfDocument = usePrepareGltfDocument()

	const sceneMetaState = useAtomValue(sceneMetaAtom)
	const currentSettings = useAtomValue(sceneViewerSettingsAtom)
	const optimization = useAtomValue(optimizationAtom)
	const optimizationRuntime = useAtomValue(optimizationRuntimeAtom)

	/**
	 * Writes the current scene to IndexedDB so local progress survives the
	 * navigation to sign-in. Returns the draft id to put in the return URL.
	 */
	const persistPendingSceneDraft = useCallback(
		() =>
			persistPendingSceneDraftOrchestrator({
				modelAvailable: Boolean(file),
				prepareGltfDocumentForUpload: prepareGltfDocument,
				sceneMetaState,
				currentSettings: {
					bounds: currentSettings.bounds,
					environment: currentSettings.env,
					interactions: currentSettings.interactions,
					camera: currentSettings.camera,
					controls: currentSettings.controls,
					shadows: currentSettings.shadows,
					normalization: currentSettings.normalization,
					hotspots: currentSettings.hotspots
				},
				optimizationSettings: optimization.optimizations ?? null,
				optimizedSceneBytes: optimizationRuntime.optimizedSceneBytes,
				clientSceneBytes: optimizationRuntime.clientSceneBytes
			}),
		[
			currentSettings,
			file,
			optimization.optimizations,
			optimizationRuntime.clientSceneBytes,
			optimizationRuntime.optimizedSceneBytes,
			prepareGltfDocument,
			sceneMetaState
		]
	)

	/**
	 * Stores the model as uploaded, before any optimization pass touches it.
	 * "Re-apply preset" restores this, so without it every later pass would stack
	 * on the previous result instead of starting over.
	 */
	const snapshotOriginalModel = useCallback(
		async (uploadedFile: ModelFile) => {
			try {
				const gltfJson = await prepareGltfDocument(uploadedFile)
				if (!gltfJson || typeof gltfJson !== 'object') return

				const gltfData = (gltfJson as { data?: unknown }).data ?? gltfJson
				const gltfAssets = (gltfJson as { assets?: unknown }).assets

				await saveOriginalSceneModel({
					sceneData: {
						gltfJson: gltfData as ServerSceneData['gltfJson'],
						assetData: await serializeSceneAssetData(gltfData, gltfAssets)
					} as ServerSceneData
				})
			} catch (error) {
				console.warn('Failed to persist the original scene to IDB:', error)
			}
		},
		[prepareGltfDocument]
	)

	const isRestoringDraft = useRestorePendingDraft()

	return { isRestoringDraft, persistPendingSceneDraft, snapshotOriginalModel }
}

/**
 * Restores the draft an auth redirect left behind, once, on arrival.
 *
 * This is the one load the publisher triggers from a URL rather than from a
 * user action, because that is exactly what it is: `?restore_draft=1` is the
 * sign-in flow handing the scene back.
 *
 * The URL is the trigger, not the state. The id is captured on the first
 * render and the restore reports itself as in progress until it settles, so
 * clearing the parameters cannot hand the route's own scene a window to load
 * over the draft, and the shell does not show an upload prompt during it.
 */
function useRestorePendingDraft(): boolean {
	const { load } = useModelContext()
	const location = useLocation()
	const navigate = useNavigate()
	const setSceneMetaState = useSetAtom(sceneMetaAtom)
	const setLastSavedSceneMeta = useSetAtom(lastSavedSceneMetaAtom)
	const setOptimizationState = useSetAtom(optimizationAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)

	// Captured once: the effect below clears these parameters when it is done.
	const [draftId] = useState(() => {
		const searchParams = new URLSearchParams(location.search)
		return searchParams.get('restore_draft') === '1'
			? searchParams.get('draft_id')
			: null
	})
	const [hasSettled, setHasSettled] = useState(false)
	const restoredRef = useRef(false)
	const applySceneSettings = useApplySceneSettings()

	const { pathname, search } = location

	useEffect(() => {
		if (!draftId || restoredRef.current) return
		restoredRef.current = true

		const clearRestoreParams = () => {
			const params = new URLSearchParams(search)
			params.delete('restore_draft')
			params.delete('draft_id')
			const nextSearch = params.toString()
			navigate(
				{ pathname, search: nextSearch ? `?${nextSearch}` : '' },
				{ replace: true }
			)
		}

		void (async () => {
			try {
				const draft = await loadPendingSceneDraft(draftId)
				if (!draft) return

				const { optimizationSettings } = draft
				if (optimizationSettings) {
					setOptimizationState((previous) => ({
						...previous,
						optimizationPreset: inferOptimizationPreset(optimizationSettings),
						optimizations: optimizationSettings
					}))
				}

				// The byte snapshot is what tells the save flow that optimization
				// already ran before the redirect, so saving stays available.
				setOptimizationRuntime((previous) => ({
					...previous,
					isSceneSizeLoading: false,
					optimizedSceneBytes:
						draft.optimizedSceneBytes ?? previous.optimizedSceneBytes,
					clientSceneBytes: draft.clientSceneBytes ?? previous.clientSceneBytes
				}))

				const result = await load({
					kind: 'scene-data',
					sceneData: draft.sceneData
				})

				if (result.status !== 'ready') {
					toast.error('Failed to restore your saved draft')
					return
				}

				// The draft carries the composed settings, and `ServerSceneData`
				// extends `SceneSettings`, so this is the settings object. Applying
				// it is what puts hotspots, interactions and normalization back into
				// the atoms: `useApplySceneSettings` is otherwise reached only when a
				// route manifest arrives, and a restored draft is an unsaved scene
				// that has none - so composing, signing in and coming back silently
				// dropped everything the author had placed.
				//
				// Not a saved baseline: this scene has no server row, and adopting
				// what was just restored as the last-saved state would make the
				// unsaved-changes check report nothing to save.
				applySceneSettings(draft.sceneData, { isSavedBaseline: false })

				setSceneMetaState(draft.sceneMeta)
				setLastSavedSceneMeta(draft.sceneMeta)

				// Re-anchor the tab's draft id: a new OAuth tab starts with empty
				// sessionStorage, and the original-model lookup is keyed by it.
				setTabDraftId(draftId)
				toast.success('Restored your unsaved scene from this browser')
			} catch (error) {
				console.error('Failed to restore pending scene draft:', error)
				toast.error('Failed to restore your saved draft')
			} finally {
				setHasSettled(true)
				clearRestoreParams()
			}
		})()
	}, [
		applySceneSettings,
		draftId,
		load,
		navigate,
		pathname,
		search,
		setLastSavedSceneMeta,
		setOptimizationRuntime,
		setOptimizationState,
		setSceneMetaState
	])

	return Boolean(draftId) && !hasSettled
}
