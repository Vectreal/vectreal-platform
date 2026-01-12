import type { JSONDocument } from '@gltf-transform/core'
import type { User } from '@supabase/supabase-js'
import type {
	ControlsProps,
	EnvironmentProps,
	OptimizationReport,
	SceneMeta,
	SceneSettings,
	SerializedAsset,
	SerializedGLTFExportResult,
	ShadowsProps
} from '@vctrl/core'

import type { ProcessState } from './publisher-config'

// Re-export core types for convenience
export type { SceneMeta, SceneSettings, SerializedAsset }

// ============================================================================
// Asset Types
// ============================================================================

/** GLTF export result for JSON transfer (uses SerializedGLTFExportResult from core). */
export type GLTFExportResult = SerializedGLTFExportResult

/** Extended GLTF document with asset metadata for tracking uploaded assets. */
export interface ExtendedGLTFDocument extends JSONDocument {
	readonly assetIds?: string[]
	readonly asset?: {
		readonly extensions?: {
			readonly VECTREAL_asset_metadata?: {
				readonly assetIds: string[]
			}
		}
	}
}

// ============================================================================
// Scene Settings Types
// ============================================================================

/** Scene settings for internal operations (uses core SceneSettings with readonly). */
export interface SceneSettingsData {
	readonly environment?: EnvironmentProps
	readonly controls?: ControlsProps
	readonly shadows?: ShadowsProps
	readonly meta?: SceneMeta
}

/** Scene configuration for API operations (includes publisher metadata). */
export interface SceneConfigData extends SceneSettingsData {
	readonly meta?: SceneMeta
	readonly process?: ProcessState
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
	readonly projectId?: string
	readonly settings?: SceneSettingsData
	readonly assetIds?: string[]
	readonly gltfJson?: JSONDocument
	readonly optimizationReport?: unknown
}

/** Parameters for retrieving scene settings. */
export type GetSceneSettingsParams = BaseSceneParams

/** Parameters for saving scene settings. */
export interface SaveSceneSettingsParams extends BaseSceneParams {
	readonly projectId: string
	readonly settings: SceneSettingsData
	readonly gltfJson: JSONDocument
	readonly optimizationReport?: OptimizationReport
}

/** Parameters for creating new scene settings. */
export interface CreateSceneSettingsParams extends BaseSceneParams {
	readonly projectId: string
	readonly previousVersion: number
	readonly settings: SceneSettingsData
	readonly gltfJson?: JSONDocument
	readonly optimizationReport?: OptimizationReport
}

/** Parameters for updating existing scene settings. */
export interface UpdateSceneSettingsParams {
	readonly sceneSettingsId: string
	readonly userId: string
	readonly settings: SceneSettingsData
	readonly gltfJson?: JSONDocument
	readonly createNewVersion?: boolean
}

/** Valid scene settings actions. */
export type SceneSettingsAction = 'save-scene-settings' | 'get-scene-settings'

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper.
 * @template T The type of the response data
 */
export interface ApiResponse<T = unknown> {
	readonly data?: T
	readonly error?: string
	readonly success: boolean
}

/** User context for authenticated API operations. */
export interface ApiUserContext {
	readonly user: User
	readonly headers?: HeadersInit
}

/** API error with structured information. */
export interface ApiError extends Error {
	readonly status: number
	readonly code?: string
}

// ============================================================================
// HTTP Constants
// ============================================================================

/** HTTP status codes commonly used in the API. */
export enum HttpStatusCode {
	OK = 200,
	CREATED = 201,
	BAD_REQUEST = 400,
	UNAUTHORIZED = 401,
	FORBIDDEN = 403,
	NOT_FOUND = 404,
	METHOD_NOT_ALLOWED = 405,
	INTERNAL_SERVER_ERROR = 500
}

/** Content types for API requests. */
export enum ContentType {
	JSON = 'application/json',
	FORM_DATA = 'multipart/form-data',
	FORM_URLENCODED = 'application/x-www-form-urlencoded'
}

// ============================================================================
// Scene Stats Types
// ============================================================================

/** Parameters for saving scene stats alongside scene settings. */
export interface SaveSceneStatsParams {
	readonly sceneId: string
	readonly userId: string
	readonly version?: number
	readonly label?: string
	readonly description?: string
	readonly optimizationReport?: OptimizationReport
	readonly totalSceneSize?: number
	readonly totalTextureSize?: number
}

/** Parameters for querying scene stats. */
export interface GetSceneStatsParams {
	readonly sceneId: string
	readonly version?: number
	readonly label?: string
	readonly limit?: number
}

/** Scene stats response data. */
export interface SceneStatsData {
	readonly id: string
	readonly sceneId: string
	readonly version: number
	readonly label?: string | null
	readonly description?: string | null
	readonly totalSceneSize?: number | null
	readonly originalSize?: number | null
	readonly optimizedSize?: number | null
	readonly compressionRatio?: string | null
	readonly totalTextureSize?: number | null
	readonly textureCount?: number | null
	readonly vertexCount?: number | null
	readonly polygonCount?: number | null
	readonly materialCount?: number | null
	readonly meshCount?: number | null
	readonly nodeCount?: number | null
	readonly appliedOptimizations?: string[] | null
	readonly optimizationSettings?: Record<string, unknown> | null
	readonly createdAt: Date
	readonly createdBy: string
}
