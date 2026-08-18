import { usePostHog } from '@posthog/react'
import { useLoadModel } from '@vctrl/hooks/use-load-model'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'

import { buildPreviewSceneEndpoint } from '../../lib/domain/scene/client/preview-scene-endpoint'
import { useSceneModel } from '../../lib/domain/scene/client/use-scene-model'
import { useConsent } from '../consent/consent-context'

import type { ModelSource } from '@vctrl/hooks/use-load-model'

interface UseSceneEmbedSceneParams {
	sceneId?: string
	projectId?: string
}

export function useSceneEmbedScene({
	sceneId,
	projectId
}: UseSceneEmbedSceneParams) {
	const [searchParams] = useSearchParams()
	const model = useLoadModel()
	const { file, sceneData, status, error, load } = model
	const posthog = usePostHog()
	const { consent } = useConsent()
	const trackedPreviewKeysRef = useRef(new Set<string>())

	const token = searchParams.get('token')?.trim() || undefined
	const sceneSource = useMemo<ModelSource | null>(() => {
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
		isLoadingScene: status === 'loading',
		sceneData,
		loadError: error,
		retrySceneLoad
	}
}
