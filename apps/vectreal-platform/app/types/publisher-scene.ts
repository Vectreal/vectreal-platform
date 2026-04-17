import type { SceneStatsData } from './api'
import type { SceneMetaState } from './publisher-config'

export interface SaveSceneResult {
	sceneId?: string
	stats?: SceneStatsData | null
	sceneMeta?: SceneMetaState
	unchanged?: boolean
	[key: string]: unknown
}

export interface SaveLocationTarget {
	targetProjectId?: string
	targetFolderId?: string | null
}

export type SaveSceneFn = () => Promise<
	SaveSceneResult | { unchanged: true } | undefined
>
