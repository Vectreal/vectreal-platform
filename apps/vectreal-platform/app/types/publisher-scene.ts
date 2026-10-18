import type { SceneStatsData } from './api'
import type { SceneMetaState } from './publisher-config'
import type { HotspotArtworkRewrite } from '../lib/domain/scene/client/hotspot-artwork-save'

export interface SaveSceneResult {
	sceneId?: string
	stats?: SceneStatsData | null
	sceneMeta?: SceneMetaState
	unchanged?: boolean
	hotspotArtworkRewrites?: HotspotArtworkRewrite[]
	[key: string]: unknown
}

export interface SaveLocationTarget {
	targetProjectId?: string
	targetFolderId?: string | null
}

export type SaveSceneFn = () => Promise<
	SaveSceneResult | { unchanged: true } | undefined
>
