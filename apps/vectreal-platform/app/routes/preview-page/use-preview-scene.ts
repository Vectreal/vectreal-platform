import { usePostHog } from '@posthog/react'
import {
	type StructuredLoadError,
	useLoadModel
} from '@vctrl/hooks/use-load-model'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { useConsent } from '../../components/consent/consent-context'
import {
	buildPreviewSceneRequest,
	loadSceneFromApi
} from '../../lib/domain/scene/client/load-scene-from-api.client'

import type { SceneLoadResult } from '@vctrl/hooks/use-load-model'

interface UsePreviewSceneParams {
	sceneId?: string
	projectId?: string
}

interface PreviewSceneError {
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

function getPreviewError(error: unknown): PreviewSceneError {
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

export function usePreviewScene({ sceneId, projectId }: UsePreviewSceneParams) {
	const [searchParams] = useSearchParams()
	const { file, loadFromServer } = useLoadModel()
	const [isLoadingScene, setIsLoadingScene] = useState(false)
	const [sceneData, setSceneData] = useState<SceneLoadResult>()
	const [previewError, setPreviewError] = useState<PreviewSceneError | null>(null)
	const posthog = usePostHog()
	const { consent } = useConsent()
	const trackedPreviewKeysRef = useRef(new Set<string>())

	const getSceneSettings = useCallback(async () => {
		if (!sceneId || !projectId) {
			return
		}

		setIsLoadingScene(true)
		setPreviewError(null)
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
				requestKey
			})

			setSceneData(loadedSceneData)
		} catch (error) {
			console.error('Failed to load preview scene:', error)
			setPreviewError(getPreviewError(error))
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
		previewError,
		retrySceneLoad: getSceneSettings
	}
}
