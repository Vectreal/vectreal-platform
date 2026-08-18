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
	/** The scene open in the publisher, if the upload is replacing its model. */
	openSceneId: null | string
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
export function useSceneUpload({
	openSceneId,
	snapshotOriginalModel
}: UseSceneUploadArgs) {
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
			// of it runs until there is a model to replace it with: a folder with two
			// models in it, or with none, must not cost the user the scene they had
			// open. Both IndexedDB snapshots are keyed per tab rather than per model,
			// so a stale one could otherwise be restored over this upload during a
			// later re-optimization.
			void clearOriginalSceneModel()
			void clearPendingSceneDraft()
			setOptimizationRuntime({
				...optimizationRuntimeInitialState,
				isSceneSizeLoading: true
			})

			// Replacing the model of an open scene keeps its composition. Anywhere
			// else the upload starts a new, unsaved scene.
			if (!openSceneId) {
				resetSceneState()
				setCurrentSceneId(null)
			}

			setSceneMeta((previous) => ({
				// Replace rather than merge. A dropped file is new content, so keeping
				// the previous thumbnail would both show the wrong image and let the
				// save flow re-link it onto this model. Editing an existing scene
				// keeps its name; a new one takes it from the file.
				...sceneMetaInitialState,
				description: openSceneId ? previous.description : '',
				name: openSceneId
					? previous.name || getSceneNameFromFileName(result.file.name)
					: getSceneNameFromFileName(result.file.name)
			}))

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
			openSceneId,
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
