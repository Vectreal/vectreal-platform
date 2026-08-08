import { useSetAtom } from 'jotai/react'
import { useEffect, useRef } from 'react'

import {
	getSettingsFromAggregate,
	shouldInitializeScene
} from '../../lib/domain/scene'
import { sceneMetaInitialState } from '../../lib/stores/publisher-config-store'
import {
	optimizationModalAtom,
	optimizationModalInitialState,
	optimizationRuntimeInitialState
} from '../../lib/stores/scene-optimization-store'

import type { UseSceneParamsSyncArgs } from './contracts'

export const useSceneParamsSync = ({
	routeState,
	actions
}: UseSceneParamsSyncArgs) => {
	const {
		paramSceneId,
		sceneMeta,
		initialSceneAggregate,
		lastSavedSceneId,
		shouldRestorePendingDraft
	} = routeState
	const {
		resetSceneState,
		setCurrentSceneId,
		setSceneMetaState,
		setLastSavedSettings,
		setLastSavedSceneMeta,
		setIsInitializing,
		setHasUnsavedChanges,
		setOptimizationRuntime,
		setLastSavedSceneId
	} = actions

	const setOptimizationModal = useSetAtom(optimizationModalAtom)
	// `undefined` means "this hook has not run yet", which `paramSceneId` can
	// never be (it is `params.sceneId?.trim() || null`). Initializing to `null`
	// instead made a fresh mount at bare /publisher indistinguishable from
	// "already on the base route", so the reset below was skipped - and because
	// the publisher's Jotai stores are module singletons that outlive the
	// layout's unmount, a /publisher/<id> -> /dashboard -> /publisher round trip
	// kept the previous scene's camera, environment and shadows.
	const previousParamSceneIdRef = useRef<null | string | undefined>(undefined)

	useEffect(() => {
		const isNewUploadFlow = !paramSceneId && !initialSceneAggregate
		const isFirstSync = previousParamSceneIdRef.current === undefined
		// Deliberately keeps the original null baseline so every downstream use of
		// `hasSceneChanged` (the hydration branch below, and `shouldInitializeScene`)
		// behaves exactly as before. Only the reset decision consults `isFirstSync`.
		const previousParamSceneId = isFirstSync
			? null
			: previousParamSceneIdRef.current
		const hasSceneChanged = previousParamSceneId !== paramSceneId
		// A first sync on bare /publisher needs the reset too: the stores may still
		// hold the scene the user came from. The draft restore path also lands
		// here, but its hydration re-applies only the model, meta and optimization
		// state, so resetting would silently drop the user's compose work.
		const shouldResetForNewUpload =
			isNewUploadFlow &&
			(hasSceneChanged || isFirstSync) &&
			!shouldRestorePendingDraft

		// Detect navigation to the scene that was just saved (null → newId after
		// first save). In this case the save flow already established correct
		// baselines, so we must NOT overwrite them with the initialised/reset values.
		const isPostSaveNavigation =
			hasSceneChanged && !!paramSceneId && paramSceneId === lastSavedSceneId

		if (shouldResetForNewUpload) {
			resetSceneState()
		}

		if (hasSceneChanged) {
			setCurrentSceneId(paramSceneId)
		}

		if (hasSceneChanged || shouldResetForNewUpload) {
			// Always close the optimization drawer when the active scene changes so
			// stale isOpen state from a previous session never bleeds into a new one.
			// The store is a module-level singleton and persists across unmounts.
			setOptimizationModal(optimizationModalInitialState)

			if (isPostSaveNavigation) {
				// Post-save navigation: baselines are already correct. Only sync the
				// server-returned stats and clear the marker so subsequent navigation
				// is treated as a genuine scene change.
				// Both SceneManifestResponse and SceneAggregateResponse expose
				// the same `settings` field; cast is safe for this read-only lookup.
				const persistedSettings = getSettingsFromAggregate(
					initialSceneAggregate as Parameters<typeof getSettingsFromAggregate>[0]
				)
				if (persistedSettings) {
					setLastSavedSettings(persistedSettings)
				}
				setLastSavedSceneMeta(sceneMeta ?? null)
				setOptimizationRuntime((prev) => ({
					...prev,
					latestSceneStats:
						initialSceneAggregate?.stats ?? prev.latestSceneStats
				}))
				setLastSavedSceneId(null)
			} else {
				// Genuine scene change: reset meta, unsaved-changes flag, and
				// optimization runtime to the server's ground-truth values.
				const nextMeta = sceneMeta ?? sceneMetaInitialState
				setSceneMetaState(nextMeta)
				setHasUnsavedChanges(false)
				setOptimizationRuntime({
					...optimizationRuntimeInitialState,
					lastSavedReportSignature: null,
					latestSceneStats: initialSceneAggregate?.stats ?? null
				})
			}
		}

		if (!isNewUploadFlow && !isPostSaveNavigation) {
			setLastSavedSceneMeta(sceneMeta ?? null)
		}
		setIsInitializing(
			shouldInitializeScene({
				hasSceneChanged,
				paramSceneId,
				initialSceneAggregate,
				isPostSaveNavigation
			})
		)

		previousParamSceneIdRef.current = paramSceneId
	}, [
		paramSceneId,
		sceneMeta,
		initialSceneAggregate,
		setSceneMetaState,
		setLastSavedSettings,
		setLastSavedSceneMeta,
		resetSceneState,
		setIsInitializing,
		setHasUnsavedChanges,
		setOptimizationRuntime,
		setCurrentSceneId,
		lastSavedSceneId,
		setLastSavedSceneId,
		setOptimizationModal,
		shouldRestorePendingDraft
	])
}
