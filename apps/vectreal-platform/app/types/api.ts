import { ContentType, HttpStatusCode } from '@vctrl/core'

import { assets, sceneSettings } from '../db/schema'

import type { ProcessState, SceneMetaState } from './publisher-config'
import type { JSONDocument } from '@gltf-transform/core'
import type { User } from '@supabase/supabase-js'
import type {
	ApiEnvelope,
	ExtendedGLTFDocument,
	Optimizations,
	OptimizationReport,
	SerializedSceneAssetDataMap,
	SceneSettings,
	SerializedGLTFExportResult
} from '@vctrl/core'

export type { SerializedSceneAssetDataMap } from '@vctrl/core'

// ============================================================================
// Asset Types
// ============================================================================

/** GLTF export result for JSON transfer (uses SerializedGLTFExportResult from core). */
export type GLTFExportResult = SerializedGLTFExportResult

/* Database record type for assets associated with scenes. */
export type SceneAssetRecord = typeof assets.$inferSelect

/** Binary asset payload returned from scene aggregate endpoints before serialization. */
export interface SceneAssetBinaryData {
	readonly data: Uint8Array
	readonly mimeType: string
	readonly fileName: string
}

/** In-memory asset map keyed by asset id. */
export type SceneAssetBinaryDataMap = Map<string, SceneAssetBinaryData>

// ============================================================================
// Scene Settings Types
// ============================================================================

/** Scene configuration for API operations (includes publisher metadata). */
export interface SceneConfigData extends SceneSettings {
	readonly process?: ProcessState
}

export type SceneSettingsRecord = typeof sceneSettings.$inferSelect

export type SceneSettingsWithAssets = {
	settings: SceneSettingsRecord
	assets: SceneAssetRecord[]
}

export type SceneSettingsUpsertInput = {
	sceneId: string
	createdBy: string
	settings: SceneSettings
}

// ============================================================================
// Scene Settings Operations
// ============================================================================

/** Common parameters for scene operations. */
interface BaseSceneParams {
	readonly sceneId: string
	readonly userId: string
}

/** Parameters for scene settings requests. */
export interface SceneSettingsRequest extends Partial<BaseSceneParams> {
	readonly action: string
	readonly requestId?: string
	readonly projectId?: string
	readonly targetProjectId?: string
	readonly targetFolderId?: string | null
	readonly meta?: SceneMetaState
	readonly settings?: SceneSettings
	readonly gltfJson?: JSONDocument
	readonly sceneAssetIds?: string[]
	readonly publishedAssetId?: string
	readonly optimizationReport?: OptimizationReport
	readonly optimizationSettings?: Optimizations
	readonly initialSceneBytes?: number
	readonly currentSceneBytes?: number
}

/** Parameters for retrieving scene settings. */
export type GetSceneSettingsParams = BaseSceneParams

/** Parameters for saving scene settings. */
export interface SaveSceneSettingsParams extends BaseSceneParams {
	readonly projectId: string
	readonly targetProjectId?: string
	readonly targetFolderId?: string | null
	readonly meta: SceneMetaState
	readonly settings: SceneSettings
	readonly gltfJson?: JSONDocument
	readonly optimizationReport?: OptimizationReport
	readonly optimizationSettings?: Optimizations
	readonly initialSceneBytes?: number
	readonly currentSceneBytes?: number
}

/** Parameters for updating existing scene settings. */
export interface UpdateSceneSettingsParams {
	readonly sceneSettingsId: string
	readonly userId: string
	readonly meta: SceneMetaState
	readonly settings: SceneSettings
	readonly gltfJson?: JSONDocument
}

export interface SceneMetadataUpdateInput {
	readonly name: string
	readonly description?: string | null
	readonly thumbnailUrl?: string | null
}

/** Valid scene settings actions. */
export type SceneSettingsAction =
	| 'prepare-scene-upload'
	| 'commit-scene-save'
	| 'commit-scene-publish'
	| 'revoke-scene-publish'
	| 'get-scene-settings'
	| 'upload-scene-asset'
	| 'upload-scene-gltf'
	| 'upload-published-glb'

export type ContentItemType = 'scene' | 'folder'

export type ContentMutationAction = 'rename' | 'delete' | 'create-folder'
export type SceneMutationAction = Exclude<
	ContentMutationAction,
	'create-folder'
>

export interface ContentActionItem {
	readonly type: ContentItemType
	readonly id: string
}

export interface ContentActionRequest {
	readonly action: SceneMutationAction
	readonly items: ContentActionItem[]
	readonly name?: string
}

export interface ContentActionResult {
	readonly type: ContentItemType
	readonly id: string
	readonly success: boolean
	readonly error?: string
}

export interface ContentActionSummary {
	readonly total: number
	readonly succeeded: number
	readonly failed: number
}

export interface ContentActionResponse {
	readonly success: boolean
	readonly action: SceneMutationAction
	readonly results: ContentActionResult[]
	readonly summary: ContentActionSummary
}

export interface CreateFolderActionResponse {
	readonly success: boolean
	readonly action: 'create-folder'
	readonly folder: {
		readonly id: string
		readonly name: string
	}
}

/** Aggregate scene response returned by GET /api/scenes/:sceneId. */
export interface SceneAggregateResponse {
	readonly sceneId: string
	readonly meta: SceneMetaState | null
	readonly stats: SceneStatsData | null
	readonly gltfJson: ExtendedGLTFDocument | null
	readonly assetData: SerializedSceneAssetDataMap | null
	readonly assets: SceneAssetRecord[] | null
	readonly settings?: SceneSettings | null
	readonly id?: string
	readonly createdAt?: Date
	readonly createdBy?: string
	readonly updatedAt?: Date
}

export interface SaveSceneSettingsResponse {
	readonly sceneId: string
	readonly stats: SceneStatsData | null
	readonly currentLocation?: SceneCurrentLocation
	readonly unchanged?: boolean
	readonly [key: string]: unknown
}

export interface PublishSceneResponse {
	readonly sceneId: string
	readonly stats: SceneStatsData | null
	readonly asset?: unknown
	readonly [key: string]: unknown
}

export interface ScenePublishStateResponse {
	readonly sceneId: string
	readonly status: 'draft' | 'published'
	readonly publishedAt: string | null
	readonly publishedAssetId: string | null
	readonly publishedAssetSizeBytes: number | null
}

export interface RevokeScenePublishResponse {
	readonly sceneId: string
	readonly status: 'draft'
	readonly revoked: true
}

export interface PublishedSceneMetaResponse {
	readonly sceneId: string
	readonly projectId: string
	readonly status: string
	readonly publishedAssetId: string
	readonly publishedAt: Date | string
	readonly publishedAssetSizeBytes?: number | null
}

export interface SceneCurrentLocation {
	readonly projectId: string | null
	readonly projectName: string | null
	readonly folderId: string | null
	readonly folderName: string | null
}

export function isSceneCurrentLocation(
	value: unknown
): value is SceneCurrentLocation {
	if (!value || typeof value !== 'object') {
		return false
	}

	const candidate = value as Record<string, unknown>

	return (
		'projectId' in candidate &&
		(typeof candidate.projectId === 'string' || candidate.projectId === null) &&
		'projectName' in candidate &&
		(typeof candidate.projectName === 'string' ||
			candidate.projectName === null) &&
		'folderId' in candidate &&
		(typeof candidate.folderId === 'string' || candidate.folderId === null) &&
		'folderName' in candidate &&
		(typeof candidate.folderName === 'string' || candidate.folderName === null)
	)
}

export interface SceneLocationOption {
	readonly id: string
	readonly name: string
}

export interface SceneLocationFolderOption {
	readonly id: string
	readonly name: string
	readonly parentFolderId: string | null
	readonly depth: number
}

export interface SceneLocationOptionsResponse {
	readonly projects: SceneLocationOption[]
	readonly folders: SceneLocationFolderOption[]
	readonly selectedProjectId: string | null
}

export interface PublisherLoaderData {
	readonly isMobile: boolean
	readonly user: User | null
	readonly sceneId: string | null
	readonly projectId: string | null
	readonly currentLocation: SceneCurrentLocation
	readonly sceneAggregate: SceneAggregateResponse | null
	readonly publishedMeta: PublishedSceneMetaResponse | null
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper.
 * @template T The type of the response data
 */
export interface ApiResponse<T = unknown> {
	readonly data?: ApiEnvelope<T>['data']
	readonly error?: ApiEnvelope<T>['error']
	readonly success: boolean
}

/** User context for authenticated API operations. */
export interface ApiUserContext {
	readonly user: User
	readonly headers?: HeadersInit
}

/** API error with structured information. */
export interface ApiError extends Error {
	readonly status: HttpStatusCode
	readonly code?: string
}

// ============================================================================
// HTTP Constants
// ============================================================================
export { HttpStatusCode, ContentType }

// ============================================================================
// Scene Stats Types
// ============================================================================

/** Parameters for saving scene stats alongside scene settings. */
export interface SaveSceneStatsParams {
	readonly sceneId: string
	readonly userId: string
	readonly label?: string
	readonly description?: string
	readonly optimizationReport?: OptimizationReport
}

/** Parameters for querying scene stats. */
export interface GetSceneStatsParams {
	readonly sceneId: string
}

/** Scene stats response data. */
export interface SceneStatsData {
	readonly id: string
	readonly sceneId: string
	readonly label?: string | null
	readonly description?: string | null
	readonly baseline?: SceneStatsSnapshot | null
	readonly optimized?: SceneStatsSnapshot | null
	readonly initialSceneBytes?: number | null
	readonly currentSceneBytes?: number | null
	readonly appliedOptimizations?: string[] | null
	readonly optimizationSettings?: Optimizations | null
	// Extended persisted metrics that do not fit the snapshot count schema.
	readonly additionalMetrics?: SceneAdditionalMetrics | null
	readonly createdAt: Date
	readonly createdBy: string
}

export interface SceneAdditionalMetrics {
	// Texture payload size in bytes before optimization.
	readonly initialTextureBytes?: number | null
	// Texture payload size in bytes after optimization.
	readonly currentTextureBytes?: number | null
	readonly [key: string]: unknown
}

export interface SceneStatsSnapshot {
	readonly verticesCount?: number | null
	readonly primitivesCount?: number | null
	readonly meshesCount?: number | null
	// Texture asset count, not texture bytes.
	readonly texturesCount?: number | null
	readonly materialsCount?: number | null
	readonly nodesCount?: number | null
}

/** Detail payload for scene stats refresh events. */
export interface SceneStatsUpdatedDetail {
	readonly sceneId?: string
}
