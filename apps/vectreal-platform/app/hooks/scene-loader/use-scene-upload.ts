import { usePostHog } from '@posthog/react'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useSetAtom } from 'jotai/react'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { useResetSceneState } from './use-scene-settings'
import { useConsent } from '../../components/consent/consent-context'
import { buildSceneUploadFailedAnalyticsProps } from '../../lib/domain/analytics/scene-events'
import { getSceneNameFromFileName } from '../../lib/domain/scene'
import { getUploadLoadErrorMessage } from '../../lib/domain/scene/scene-load-error-messages'
import {
	clearOriginalSceneModel,
	clearPendingSceneDraft
} from '../../lib/persistence/pending-scene-idb'
import {
	currentSceneIdAtom,
	sceneMetaAtom,
	sceneMetaInitialState
} from '../../lib/stores/publisher-config-store'
import {
	optimizationRuntimeAtom,
	optimizationRuntimeInitialState
} from '../../lib/stores/scene-optimization-store'

import type {
	InputFileOrDirectory,
	ModelFile
} from '@vctrl/hooks/use-load-model'

interface UseSceneUploadArgs {
	/** Snapshots the freshly loaded model to IndexedDB for re-optimization. */
	snapshotOriginalModel: (uploadedFile: ModelFile) => Promise<void>
}

/**
 * Everything that happens when a user drops a model in.
 *
 * Written as one function on purpose. Before, these steps were spread across
 * four subscriptions to a global event bus, and a load that ended early (no
 * supported file, two models in one folder) simply skipped the ones that would
 * have cleared the loading flag. Here the order is the order you read.
 */
export function useSceneUpload({ snapshotOriginalModel }: UseSceneUploadArgs) {
	const { load } = useModelContext()
	const posthog = usePostHog()
	const { consent } = useConsent()
	const resetSceneState = useResetSceneState()
	const setSceneMeta = useSetAtom(sceneMetaAtom)
	const setCurrentSceneId = useSetAtom(currentSceneIdAtom)
	const setOptimizationRuntime = useSetAtom(optimizationRuntimeAtom)

	const uploadFiles = useCallback(
		async (files: InputFileOrDirectory) => {
			const startedAt = Date.now()

			const result = await load({ kind: 'files', files })

			if (result.status !== 'ready') {
				const message = getUploadLoadErrorMessage(result.error)
				toast.error(message)

				if (consent?.analytics && result.error) {
					posthog?.capture(
						'scene_upload_failed',
						buildSceneUploadFailedAnalyticsProps(result.error, message)
					)
				}
				return result
			}

			// Everything below replaces what the previous model left behind, and none
			// of it runs until there is a model to replace it with, so a folder with
			// two models in it, or with none, costs nothing.
			//
			// A drop always starts a new unsaved scene: the drop zone is only on
			// screen when there is no scene open, so there is nothing to merge with.
			// Both IndexedDB snapshots are keyed per tab rather than per model, and
			// the clear is awaited so it cannot land after the snapshot below and
			// leave re-optimization without its pristine baseline.
			await clearOriginalSceneModel()
			await clearPendingSceneDraft()
			// `isSceneSizeLoading` is left to useSceneSizeInitializer, which derives
			// it from the model that just arrived.
			setOptimizationRuntime(optimizationRuntimeInitialState)
			resetSceneState()
			setCurrentSceneId(null)

			// Replace rather than merge: a dropped file is new content, so keeping
			// the previous thumbnail would both show the wrong image and let the
			// save flow re-link it onto this model.
			setSceneMeta({
				...sceneMetaInitialState,
				name: getSceneNameFromFileName(result.file.name)
			})

			toast.success(`Loaded ${result.file.name}`)

			if (consent?.analytics) {
				posthog?.capture('scene_upload_succeeded', {
					file_format:
						result.file.name.split('.').pop()?.toLowerCase() ?? 'unknown',
					duration_ms: Date.now() - startedAt
				})
			}

			// The optimizer has the model by now (the load awaits its ingest), so the
			// pre-optimization snapshot can be taken without waiting on a render.
			await snapshotOriginalModel(result.file)

			return result
		},
		[
			consent?.analytics,
			load,
			posthog,
			resetSceneState,
			setCurrentSceneId,
			setOptimizationRuntime,
			setSceneMeta,
			snapshotOriginalModel
		]
	)

	return { uploadFiles }
}
