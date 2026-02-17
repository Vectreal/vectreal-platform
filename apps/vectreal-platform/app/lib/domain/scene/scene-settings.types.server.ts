import type { assets, sceneSettings } from '../../../db/schema'
import type { SceneSettingsData } from '../../../types/api'

export type SceneSettingsRecord = typeof sceneSettings.$inferSelect
export type SceneAssetRecord = typeof assets.$inferSelect

export type SceneSettingsWithAssets = {
	settings: SceneSettingsRecord
	assets: SceneAssetRecord[]
}

export type SceneSettingsUpsertInput = {
	sceneId: string
	createdBy: string
	settings: SceneSettingsData
}
