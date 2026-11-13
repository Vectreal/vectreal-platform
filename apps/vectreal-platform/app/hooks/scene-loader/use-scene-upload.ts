import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useSetAtom } from 'jotai/react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { useResetSceneState } from './use-scene-settings'
import { useConsent } from '../../components/consent/consent-context'
import { buildSceneUploadFailedAnalyticsProps } from '../../lib/domain/analytics/scene-events'
import { getSceneNameFromFileName } from '../../lib/domain/scene'
import { getUploadLoadErrorMessage } from '../../lib/domain/scene/scene-load-error-messages'
import { clearPendingSceneDraft } from '../../lib/persistence/pending-scene-idb'
import { usePostHog } from '../../lib/posthog/posthog-react'
import {
	currentSceneIdAtom,
	sceneMetaAtom,
	sceneMetaInitialState
} from '../../lib/stores/publisher-config-store'

import type {
	InputFileOrDirectory,
	ModelSource,
	StructuredLoadError
} from '@vctrl/hooks/use-load-model'

/** What a person can add to an empty stage: their own files, or a model at a URL. */
export type AddedModelSource = Extract<ModelSource, { kind: 'files' | 'url' }>

/**
 * Everything that happens when a model is added to the stage: dropped,
 * picked, or opened from a URL (a sample, an example scene, a generated
 * variant).
 *
 * Written as one function on purpose. Before, these steps were spread across
 * four subscriptions to a global event bus, and a load that ended early (no
 * supported file, two models in one folder) simply skipped the ones that would
 * have cleared the loading flag. Here the order is the order you read.
 *
 * A URL goes to the loader as a URL, not fetched here first: the download is
 * then the loader's `fetching` phase, so the stage shows one loading state
 * from the click on, and a newer load or a reset cancels it like any other.
 */
export function useSceneUpload() {
	const { load } = useModelContext()
	const posthog = usePostHog()
	const { consent } = useConsent()
	const resetSceneState = useResetSceneState()
	const setSceneMeta = useSetAtom(sceneMetaAtom)
	const setCurrentSceneId = useSetAtom(currentSceneIdAtom)

	/** What is being opened, for the loading surface's title; null for a drop. */
	const [subject, setSubject] = useState<string | null>(null)

	const openModel = useCallback(
		async (
			source: AddedModelSource,
			{
				label,
				failureMessage
			}: {
				/** What is being opened, for the loading surface: "Downloading Rocket". */
				label?: string
				/** The caller's own words for a failure it knows more about; null for the loader's. */
				failureMessage?: (error: StructuredLoadError | null) => string | null
			} = {}
		) => {
			const startedAt = Date.now()

			setSubject(label ?? null)
			const result = await load(source)

			/*
			  A newer load took the stage: a scene opened from the list while a
			  sample downloaded, a second drop. Everything below would describe
			  this model over that one, so none of it runs.
			*/
			if (!result.stillCurrent()) return result
			setSubject(null)

			// Cancelled by a reset or the caller's signal: nothing went wrong,
			// so nothing is said.
			if (result.status === 'empty') return result

			if (result.status !== 'ready') {
				const message =
					failureMessage?.(result.error) ??
					getUploadLoadErrorMessage(result.error)
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
			// A drop always starts a new unsaved scene: the stage only takes a drop
			// while it is empty, so there is nothing to merge with.
			await clearPendingSceneDraft()
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

			return result
		},
		[
			consent?.analytics,
			load,
			posthog,
			resetSceneState,
			setCurrentSceneId,
			setSceneMeta
		]
	)

	const uploadFiles = useCallback(
		(files: InputFileOrDirectory) => openModel({ kind: 'files', files }),
		[openModel]
	)

	return { openModel, uploadFiles, subject }
}
