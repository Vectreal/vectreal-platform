import { usePostHog } from '@posthog/react'
import { useLoadModel } from '@vctrl/hooks/use-load-model'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'

import { embedManifestToScenePayload } from '../../lib/domain/scene/client/embed-manifest-payload'
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
	const sceneSource = useMemo<ModelSource | null>(() => {
		if (!sceneId || !projectId) {
			return null
		}

		/*
		  The manifest the document carried, loaded as it stands: no manifest
		  request, and no key sent as a header with the asset requests, which is
		  what lets them reuse the document's preloads.
		*/
		if (initialManifest) {
			return {
				kind: 'scene-data',
				sceneId,
				sceneData: embedManifestToScenePayload(initialManifest),
				parseMode: 'direct'
			}
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
	}, [initialManifest, projectId, sceneId, token])

	useSceneModel(model, sceneSource)

	const retrySceneLoad = useCallback(() => {
		if (sceneSource) void load(sceneSource)
	}, [load, sceneSource])

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
