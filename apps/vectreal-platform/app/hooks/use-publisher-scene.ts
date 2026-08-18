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
import { resolveDefaultSceneCameraId } from '../lib/domain/scene/scene-camera'
import { clearPendingSceneDraft } from '../lib/persistence/pending-scene-idb'
import {
	currentSceneIdAtom,
	lastSavedSceneIdAtom,
	lastSavedSceneMetaAtom,
	lastSavedSettingsAtom,
	processAtom,
	sceneMetaAtom
} from '../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom, optimizationAtom } from '../lib/stores/scene-optimization-store'
import { sceneViewerSettingsAtom } from '../lib/stores/scene-settings-store'

import type { SceneManifestResponse } from '../types/api'
import type { SceneSettings } from '@vctrl/core'
import type { SceneScreenshotOptions } from '@vctrl/viewer'

const THUMBNAIL_CAPTURE_OPTIONS: SceneScreenshotOptions = {
	width: 1280,
	height: 720,
	mimeType: 'image/webp',
	quality: 0.86,
	mode: 'auto-fit'
}

interface UsePublisherSceneArgs {
	sceneId: null | string
	userId?: string
	sceneManifest: SceneManifestResponse | null
}

/**
 * The publisher's scene, assembled from four independent pieces.
 *
 * Each piece owns one verb and nothing else: the route puts a saved scene on
 * screen, a drop puts an uploaded one there, IndexedDB survives the sign-in
 * round trip, and the save flow writes back. They share state through the
 * publisher's atoms rather than through each other.
 */
export function useSceneLoader({
	sceneId,
	userId,
	sceneManifest
}: UsePublisherSceneArgs) {
	const { status } = useModelContext()
	const revalidator = useRevalidator()
	const { requestSceneScreenshot, requestShadowBake } =
		usePublisherViewerCapture()

	const { retry: retrySceneLoad } = useSceneSource({ sceneId, sceneManifest })

	const { persistPendingSceneDraft, snapshotOriginalModel } = useSceneDraft()
	const { uploadFiles } = useSceneUpload({ sceneId, snapshotOriginalModel })

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

	const captureSceneThumbnail = useCallback(async () => {
		try {
			// Always the camera the scene opens on, so the automatic capture agrees
			// with the manual "set opening view" action rather than framing
			// something the viewer will never see.
			return await requestSceneScreenshot({
				...THUMBNAIL_CAPTURE_OPTIONS,
				targetCameraId: resolveDefaultSceneCameraId(currentSettings.camera?.cameras)
			})
		} catch (error) {
			console.warn('[scene-settings] thumbnail capture failed', error)
			return null
		}
	}, [currentSettings.camera?.cameras, requestSceneScreenshot])

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
