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
	resolveRestoredDraftOptimization,
	restoreDraftSource
} from '../../lib/domain/scene'
import {
	loadPendingSceneDraft,
	setTabDraftId
} from '../../lib/persistence/pending-scene-idb'
import {
	lastSavedSceneMetaAtom,
	sceneMetaAtom
} from '../../lib/stores/publisher-config-store'
import {
	documentOptimizationsAtom,
	keptOriginalAtom,
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../lib/stores/scene-optimization-store'
import { sceneViewerSettingsAtom } from '../../lib/stores/scene-settings-store'

/**
 * The publisher's IndexedDB side: the draft that survives an auth redirect.
 *
 * Persisting is a plain function called from the save button; the restore is a
 * route state (`?restore_draft=1`) and so runs once when that route is entered.
 */
export function useSceneDraft() {
	const { file, optimizer } = useModelContext()
	const prepareGltfDocument = usePrepareGltfDocument()

	const sceneMetaState = useAtomValue(sceneMetaAtom)
	const currentSettings = useAtomValue(sceneViewerSettingsAtom)
	const documentOptimizations = useAtomValue(documentOptimizationsAtom)
	const { sourceSettings } = useAtomValue(optimizationAtom)
	const { keep: keepOriginal } = useAtomValue(keptOriginalAtom)
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
				currentSettings,
				optimizationSettings: documentOptimizations,
				sourceGlb: optimizer.getSource(),
				sourceSettings,
				keepOriginal,
				optimizedSceneBytes: optimizationRuntime.optimizedSceneBytes,
				clientSceneBytes: optimizationRuntime.clientSceneBytes
			}),
		[
			currentSettings,
			documentOptimizations,
			sourceSettings,
			keepOriginal,
			file,
			optimizer,
			optimizationRuntime.clientSceneBytes,
			optimizationRuntime.optimizedSceneBytes,
			prepareGltfDocument,
			sceneMetaState
		]
	)

	const isRestoringDraft = useRestorePendingDraft()

	return { isRestoringDraft, persistPendingSceneDraft }
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
	const { load, optimizer } = useModelContext()
	const { setSource } = optimizer
	const location = useLocation()
	const navigate = useNavigate()
	const setSceneMetaState = useSetAtom(sceneMetaAtom)
	const setLastSavedSceneMeta = useSetAtom(lastSavedSceneMetaAtom)
	const setOptimizationState = useSetAtom(optimizationAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)
	const setKeptOriginal = useSetAtom(keptOriginalAtom)

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

				const { sourceGlb } = draft
				const { sourceSettings, derivedFrom } =
					resolveRestoredDraftOptimization(draft)
				setOptimizationState((previous) => ({
					...previous,
					optimizationPreset: inferOptimizationPreset(derivedFrom),
					optimizations: derivedFrom,
					sourceSettings,
					derivedFrom
				}))

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

				// The load made the draft's already-optimized document the original.
				// Its real original came with the draft; without this, the next pass
				// would start from the optimized version and quality lost to the
				// previous preset could never come back.
				const missedOriginal = await restoreDraftSource({
					sourceGlb,
					isCurrent: result.stillOnScreen,
					setSource
				})
				// The source is then the restored version, which embodies the
				// settings it was derived from.
				if (missedOriginal) {
					const restored = resolveRestoredDraftOptimization({
						...draft,
						sourceGlb: null,
						sourceSettings: null
					})
					setOptimizationState((previous) => ({
						...previous,
						sourceSettings: restored.sourceSettings,
						derivedFrom: restored.derivedFrom
					}))
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
				// The author's choice about the original survives the sign-in too.
				setKeptOriginal((previous) => ({
					...previous,
					keep: draft.keepOriginal ?? true
				}))

				setSceneMetaState(draft.sceneMeta)
				setLastSavedSceneMeta(draft.sceneMeta)

				// Re-anchor the tab's draft id: a new OAuth tab starts with empty
				// sessionStorage, and clearing the draft after a save is keyed by it.
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
		setSceneMetaState,
		setSource
	])

	return Boolean(draftId) && !hasSettled
}
