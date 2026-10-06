import { usePostHog } from '@posthog/react'
import { useLoadModel } from '@vctrl/hooks/use-load-model'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'

import { sceneSourceFromManifest } from '../../lib/domain/scene/client/embed-manifest-payload'
import { buildPreviewSceneEndpoint } from '../../lib/domain/scene/client/preview-scene-endpoint'
import { useSceneModel } from '../../lib/domain/scene/client/use-scene-model'
import { useConsent } from '../consent/consent-context'

import type { SceneEmbedManifestResponse } from '../../types/api'
import type { ModelSource } from '@vctrl/hooks/use-load-model'

interface UseSceneEmbedSceneParams {
	sceneId?: string
	projectId?: string
	initialManifest?: SceneEmbedManifestResponse | null
}

export function useSceneEmbedScene({
	sceneId,
	projectId,
	initialManifest
}: UseSceneEmbedSceneParams) {
	const [searchParams] = useSearchParams()
	const model = useLoadModel()
	const { file, sceneData, error, load } = model
	const posthog = usePostHog()
	const { consent } = useConsent()
	const trackedPreviewKeysRef = useRef(new Set<string>())

	const token = searchParams.get('token')?.trim() || undefined
	const serverSource = useMemo<ModelSource | null>(() => {
		if (!sceneId || !projectId) {
			return null
		}

		return {
			kind: 'server',
			sceneId,
			serverOptions: {
				endpoint: buildPreviewSceneEndpoint({ sceneId, projectId, token }),
				apiKey: token
			},
			parseMode: 'direct'
		}
	}, [projectId, sceneId, token])

	const sceneSource = useMemo(
		() =>
			sceneId
				? sceneSourceFromManifest(sceneId, initialManifest, serverSource)
				: serverSource,
		[initialManifest, sceneId, serverSource]
	)

	useSceneModel(model, sceneSource)

	// Always from the server: the document's manifest signs its asset URLs for
	// an hour or two, and a retry in a tab left open longer would replay them.
	const retrySceneLoad = useCallback(() => {
		if (serverSource) void load(serverSource)
	}, [load, serverSource])

	useEffect(() => {
		if (!consent?.analytics || !sceneData || !sceneId || !projectId) {
			return
		}

		const trackingKey = `${sceneId}:${projectId}`
		if (trackedPreviewKeysRef.current.has(trackingKey)) {
			return
		}

		trackedPreviewKeysRef.current.add(trackingKey)
		posthog?.capture('preview_viewed', {
			scene_id: sceneId,
			embed_type: 'link'
		})
	}, [consent?.analytics, posthog, projectId, sceneData, sceneId])

	return {
		file,
		sceneData,
		loadError: error,
		retrySceneLoad
	}
}
