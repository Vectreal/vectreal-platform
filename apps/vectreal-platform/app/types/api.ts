import type { JSONDocument } from '@gltf-transform/core'
import type { User } from '@supabase/supabase-js'
import type {
	ControlsProps,
	EnvironmentProps,
	ShadowsProps,
	ToneMappingProps
} from '@vctrl/viewer'

import type { MetaState, ProcessState } from './publisher-config'

// ============================================================================
// Asset Types
// ============================================================================

/** Serialized asset for JSON transfer (Map cannot be serialized). */
export interface SerializedAsset {
	readonly fileName: string
	readonly data: number[] // Uint8Array as number array for JSON
	readonly mimeType: string
}

/** GLTF export result matching ModelExporter output. */
export interface GLTFExportResult {
	readonly data: Record<string, unknown>
	readonly format: 'gltf'
	readonly size: number
	readonly exportTime: number
	readonly assets?: Map<string, Uint8Array> | SerializedAsset[]
	readonly assetIds?: Map<string, number>
}

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

/** Metadata for scene configuration. */
interface SceneMeta {
	readonly sceneName?: string
	readonly thumbnailUrl?: string
}

/** Common viewer properties shared across scene configurations. */
interface ViewerSettings {
	readonly environment?: EnvironmentProps
	readonly toneMapping?: ToneMappingProps
	readonly controls?: ControlsProps
	readonly shadows?: ShadowsProps
}

/** Scene settings for internal operations. */
export interface SceneSettingsData extends ViewerSettings {
	readonly meta?: SceneMeta
}

/** Scene configuration for API operations (includes publisher metadata). */
export interface SceneConfigData extends ViewerSettings {
	readonly meta?: MetaState
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
}

/** Parameters for retrieving scene settings. */
export type GetSceneSettingsParams = BaseSceneParams

/** Parameters for saving scene settings. */
export interface SaveSceneSettingsParams extends BaseSceneParams {
	readonly projectId: string
	readonly settings: SceneSettingsData
	readonly gltfJson: JSONDocument
}

/** Parameters for creating new scene settings. */
export interface CreateSceneSettingsParams extends BaseSceneParams {
	readonly projectId: string
	readonly previousVersion: number
	readonly settings: SceneSettingsData
	readonly gltfJson?: JSONDocument
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
