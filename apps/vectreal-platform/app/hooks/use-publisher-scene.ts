import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback } from 'react'
import { useRevalidator } from 'react-router'

import { usePrepareGltfDocument } from './scene-loader/use-scene-document-export'
import { useSceneDraft } from './scene-loader/use-scene-draft'
import { useSceneSaveFlow } from './scene-loader/use-scene-save-flow'
import { useSceneSource } from './scene-loader/use-scene-source'
import { useSceneUpload } from './scene-loader/use-scene-upload'
import { usePublisherViewerCapture } from '../components/publisher/publisher-viewer-capture-context'
import { OPENING_VIEW_CAPTURE_OPTIONS } from '../components/publisher/shell/use-opening-view'
import { clearPendingSceneDraft } from '../lib/persistence/pending-scene-idb'
import {
	currentSceneIdAtom,
	lastSavedSceneIdAtom,
	lastSavedSceneMetaAtom,
	lastSavedSettingsAtom,
	processAtom,
	sceneMetaAtom
} from '../lib/stores/publisher-config-store'
import {
	optimizationRuntimeAtom,
	optimizationAtom
} from '../lib/stores/scene-optimization-store'
import { sceneViewerSettingsAtom } from '../lib/stores/scene-settings-store'

import type { SceneManifestResponse } from '../types/api'
import type { SceneSettings } from '@vctrl/core'

interface UsePublisherSceneArgs {
	sceneId: null | string
	userId?: string
	sceneManifest: SceneManifestResponse | null
}

export interface PublisherScene {
	/**
	 * The scene the publisher actually has open. A route id with no manifest
	 * behind it (signed out, expired session) is not one, and treating it as one
	 * is how an upload used to inherit a scene it had nothing to do with.
	 */
	openSceneId: null | string
	isRestoringDraft: boolean
	uploadFiles: ReturnType<typeof useSceneUpload>['uploadFiles']
	retrySceneLoad: () => void
	saveSceneSettings: ReturnType<typeof useSceneSaveFlow>['saveSceneSettings']
	saveAvailability: ReturnType<typeof useSceneSaveFlow>['saveAvailability']
	persistPendingSceneDraft: ReturnType<
		typeof useSceneDraft
	>['persistPendingSceneDraft']
}

/**
 * The publisher's scene, assembled from four independent pieces.
 *
 * Each piece owns one verb and nothing else: the route puts a saved scene on
 * screen, a drop puts an uploaded one there, IndexedDB survives the sign-in
 * round trip, and the save flow writes back. They share state through the
 * publisher's atoms rather than through each other.
 */
export function usePublisherScene({
	sceneId,
	userId,
	sceneManifest
}: UsePublisherSceneArgs): PublisherScene {
	const { status } = useModelContext()
	const revalidator = useRevalidator()
	const { requestSceneScreenshot, requestShadowBake } =
		usePublisherViewerCapture()

	const openSceneId = sceneManifest ? sceneId : null

	const { isRestoringDraft, persistPendingSceneDraft, snapshotOriginalModel } =
		useSceneDraft()
	const { retry: retrySceneLoad } = useSceneSource({
		routeSceneId: sceneId,
		openSceneId,
		sceneManifest,
		isRestoringDraft
	})
	const { uploadFiles } = useSceneUpload({ openSceneId, snapshotOriginalModel })

	const [currentSceneId, setCurrentSceneId] = useAtom(currentSceneIdAtom)
	const [sceneMetaState, setSceneMetaState] = useAtom(sceneMetaAtom)
	const [lastSavedSettings, setLastSavedSettings] = useAtom(
		lastSavedSettingsAtom
	)
	const [lastSavedSceneMeta, setLastSavedSceneMeta] = useAtom(
		lastSavedSceneMetaAtom
	)
	const [lastSavedSceneId, setLastSavedSceneId] = useAtom(lastSavedSceneIdAtom)
	const setProcess = useSetAtom(processAtom)
	const viewerSettings = useAtomValue(sceneViewerSettingsAtom)
	const { optimizations: optimizationSettings } = useAtomValue(optimizationAtom)
	const [optimizationRuntime, setOptimizationRuntime] = useAtom(
		optimizationRuntimeAtom
	)
	const { optimizer } = useModelContext(true)
	const prepareGltfDocumentForUpload = usePrepareGltfDocument()

	const currentSettings: SceneSettings = {
		bounds: viewerSettings.bounds,
		environment: viewerSettings.env,
		interactions: viewerSettings.interactions,
		camera: viewerSettings.camera,
		controls: viewerSettings.controls,
		shadows: viewerSettings.shadows,
		normalization: viewerSettings.normalization,
		hotspots:
			viewerSettings.hotspots.length > 0 ? viewerSettings.hotspots : undefined
	}

	const setHasUnsavedChanges = useCallback(
		(hasUnsavedChanges: boolean) => {
			setProcess((previous) =>
				previous.hasUnsavedChanges === hasUnsavedChanges
					? previous
					: { ...previous, hasUnsavedChanges }
			)
		},
		[setProcess]
	)

	/**
	 * The fallback for a scene that reaches save without a thumbnail: the same
	 * live frame the opening-view capture takes, so both produce the same image
	 * and the placeholder always matches the view the scene resolves into.
	 */
	const captureSceneThumbnail = useCallback(async () => {
		try {
			return await requestSceneScreenshot(OPENING_VIEW_CAPTURE_OPTIONS)
		} catch (error) {
			console.warn('[scene-settings] thumbnail capture failed', error)
			return null
		}
	}, [requestSceneScreenshot])

	const captureShadowBake = useCallback(async () => {
		try {
			return await requestShadowBake()
		} catch (error) {
			console.warn('[scene-settings] shadow bake capture failed', error)
			return null
		}
	}, [requestShadowBake])

	const { saveSceneSettings, saveAvailability } = useSceneSaveFlow({
		scenePersistence: {
			userId,
			currentSceneId,
			setCurrentSceneId,
			currentSettings,
			sceneMetaState,
			setSceneMetaState,
			lastSavedSettings,
			setLastSavedSettings,
			lastSavedSceneMeta,
			setLastSavedSceneMeta,
			lastSavedSceneId,
			setLastSavedSceneId,
			isLoading: status === 'loading'
		},
		optimizationState: {
			optimizationSettings,
			optimizationReport: optimizer?.report,
			latestSceneStats: optimizationRuntime.latestSceneStats,
			optimizedSceneBytes: optimizationRuntime.optimizedSceneBytes,
			clientSceneBytes: optimizationRuntime.clientSceneBytes,
			lastSavedReportSignature: optimizationRuntime.lastSavedReportSignature,
			setOptimizationRuntime
		},
		actions: {
			setHasUnsavedChanges,
			revalidate: () => revalidator.revalidate(),
			clearPendingDraft: clearPendingSceneDraft,
			createRequestId,
			prepareGltfDocumentForUpload,
			captureSceneThumbnail,
			captureShadowBake
		}
	})

	return {
		openSceneId,
		isRestoringDraft,
		uploadFiles,
		retrySceneLoad,
		saveSceneSettings,
		saveAvailability,
		persistPendingSceneDraft
	}
}

const createRequestId = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
