import { useLoadModel } from '@vctrl/hooks/use-load-model'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import {
	buildPreviewSceneRequest,
	loadSceneFromApi
} from '../../lib/domain/scene/client/load-scene-from-api.client'

import type { SceneLoadResult } from '@vctrl/hooks/use-load-model'

interface UsePreviewSceneParams {
	sceneId?: string
	projectId?: string
}

export function usePreviewScene({ sceneId, projectId }: UsePreviewSceneParams) {
	const [searchParams] = useSearchParams()
	const { file, loadFromServer } = useLoadModel()
	const [isLoadingScene, setIsLoadingScene] = useState(false)
	const [sceneData, setSceneData] = useState<SceneLoadResult>()

	const getSceneSettings = useCallback(async () => {
		if (!sceneId || !projectId) {
			return
		}

		setIsLoadingScene(true)
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
		} finally {
			setIsLoadingScene(false)
		}
	}, [loadFromServer, projectId, sceneId, searchParams])

	useEffect(() => {
		if (sceneId && projectId && sceneData?.sceneId !== sceneId) {
			void getSceneSettings()
		}
	}, [getSceneSettings, projectId, sceneData, sceneId])

	return {
		file,
		isLoadingScene,
		sceneData
	}
}
