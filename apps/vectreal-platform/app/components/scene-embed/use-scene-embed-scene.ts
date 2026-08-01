import { usePostHog } from '@posthog/react'
import {
	type StructuredLoadError,
	useLoadModel
} from '@vctrl/hooks/use-load-model'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import {
	buildPreviewSceneRequest,
	loadSceneFromApi
} from '../../lib/domain/scene/client/load-scene-from-api.client'
import { useConsent } from '../consent/consent-context'

import type { SceneLoadResult } from '@vctrl/hooks/use-load-model'

interface UseSceneEmbedSceneParams {
	sceneId?: string
	projectId?: string
}

interface SceneEmbedLoadError {
	message: string
	code?: StructuredLoadError['code']
}

function isStructuredLoadError(error: unknown): error is StructuredLoadError {
	if (!error || typeof error !== 'object') {
		return false
	}

	const candidate = error as Partial<StructuredLoadError>
	return (
		typeof candidate.code === 'string' &&
		typeof candidate.message === 'string' &&
		typeof candidate.source === 'string'
	)
}

function toSceneEmbedLoadError(error: unknown): SceneEmbedLoadError {
	if (isStructuredLoadError(error)) {
		return {
			message: error.message,
			code: error.code
		}
	}

	if (error instanceof Error) {
		return {
			message: error.message
		}
	}

	return {
		message: 'Failed to load scene preview.'
	}
}

export function useSceneEmbedScene({ sceneId, projectId }: UseSceneEmbedSceneParams) {
	const [searchParams] = useSearchParams()
	const { file, loadFromServer } = useLoadModel()
	const [isLoadingScene, setIsLoadingScene] = useState(false)
	const [sceneData, setSceneData] = useState<SceneLoadResult>()
	const [loadError, setLoadError] = useState<SceneEmbedLoadError | null>(null)
	const posthog = usePostHog()
	const { consent } = useConsent()
	const trackedPreviewKeysRef = useRef(new Set<string>())

	const getSceneSettings = useCallback(async () => {
		if (!sceneId || !projectId) {
			return
		}

		setIsLoadingScene(true)
		setLoadError(null)
		const token = searchParams.get('token')?.trim() || undefined
		const { endpoint, requestKey } = buildPreviewSceneRequest({
			sceneId,
			projectId,
			token
		})

		try {
			const loadedSceneData = await loadSceneFromApi({
				sceneId,
				endpoint,
				loadFromServer,
				apiKey: token,
				requestKey,
				parseMode: 'direct'
			})

			setSceneData(loadedSceneData)
		} catch (error) {
			console.error('Failed to load preview scene:', error)
			setLoadError(toSceneEmbedLoadError(error))
		} finally {
			setIsLoadingScene(false)
		}
	}, [loadFromServer, projectId, sceneId, searchParams])

	useEffect(() => {
		if (sceneId && projectId && sceneData?.sceneId !== sceneId) {
			void getSceneSettings()
		}
	}, [getSceneSettings, projectId, sceneData, sceneId])

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
		isLoadingScene,
		sceneData,
		loadError,
		retrySceneLoad: getSceneSettings
	}
}
