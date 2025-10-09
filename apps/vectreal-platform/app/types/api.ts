import { JSONDocument } from '@gltf-transform/core'
import type { User } from '@supabase/supabase-js'

import type {
	ControlsProps,
	EnvironmentProps,
	ShadowsProps,
	ToneMappingProps
} from '@vctrl/viewer'

import { MetaState, ProcessState } from './publisher-config'

/**
 * Serialized asset for JSON transfer (Map cannot be serialized)
 */
export interface SerializedAsset {
	readonly fileName: string
	readonly data: number[] // Uint8Array as number array for JSON
	readonly mimeType: string
}

/**
 * GLTF Export Result interface matching the ModelExporter output
 */
export interface GLTFExportResult {
	readonly data: Record<string, unknown>
	readonly format: 'gltf'
	readonly size: number
	readonly exportTime: number
	readonly assets?: Map<string, Uint8Array> | SerializedAsset[]
	readonly assetIds?: Map<string, number>
}

/**
 * Extended GLTF Document with asset metadata for tracking uploaded assets
 */
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

/**
 * Base scene settings interface for common viewer properties.
 */
export interface BaseSceneSettings {
	readonly environment?: EnvironmentProps
	readonly toneMapping?: ToneMappingProps
	readonly controls?: ControlsProps
	readonly shadows?: ShadowsProps
}

/**
 * Scene settings data structure for internal operations.
 */
export interface SceneSettingsData extends BaseSceneSettings {
	readonly meta?: {
		readonly sceneName?: string
		readonly thumbnailUrl?: string
		readonly isSaved?: boolean
	}
}

/**
 * Scene configuration data for API operations.
 */
export interface SceneConfigData extends BaseSceneSettings {
	readonly meta?: MetaState
	readonly process?: ProcessState
}

/**
 * Standard API response wrapper.
 * @template T The type of the response data
 */
export interface ApiResponse<T = unknown> {
	readonly data?: T
	readonly error?: string
	readonly success: boolean
}

/**
 * User context for authenticated API operations.
 */
export interface ApiUserContext {
	readonly user: User
	readonly headers?: HeadersInit
}

/**
 * HTTP status codes commonly used in the API.
 */
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

/**
 * Content types for API requests.
 */
export enum ContentType {
	JSON = 'application/json',
	FORM_DATA = 'multipart/form-data',
	FORM_URLENCODED = 'application/x-www-form-urlencoded'
}
/**
 * Scene settings data structure for API operations.
 */
export interface SceneSettingsData {
	readonly environment?: EnvironmentProps
	readonly toneMapping?: ToneMappingProps
	readonly controls?: ControlsProps
	readonly shadows?: ShadowsProps
	readonly meta?: {
		readonly sceneName?: string
		readonly thumbnailUrl?: string
		readonly isSaved?: boolean
	}
}

/**
 * Scene settings request parameters.
 */
export interface SceneSettingsRequest {
	readonly action: string
	readonly sceneId: string
	readonly projectId?: string
	readonly userId?: string
	readonly settings?: SceneSettingsData
	readonly assetIds?: string[]
	readonly gltfJson?: JSONDocument
}

/**
 * Parameters for saving scene settings.
 */
export interface SaveSceneSettingsParams {
	readonly sceneId: string
	readonly projectId: string
	readonly settings: SceneSettingsData
	readonly gltfJson: JSONDocument
	readonly userId: string
}

/**
 * Parameters for creating new scene settings.
 */
export interface CreateSceneSettingsParams {
	readonly projectId: string
	readonly sceneId: string
	readonly previousVersion: number
	readonly userId: string
	readonly settings: SceneSettingsData
	readonly gltfJson?: JSONDocument
}

/**
 * Parameters for updating existing scene settings.
 */
export interface UpdateSceneSettingsParams {
	readonly sceneSettingsId: string
	readonly userId: string
	readonly settings: SceneSettingsData
	readonly gltfJson?: JSONDocument
	readonly createNewVersion?: boolean
}

/**
 * Parameters for retrieving scene settings.
 */
export interface GetSceneSettingsParams {
	readonly sceneId: string
	readonly userId: string
}

/**
 * Valid scene settings actions.
 */
export type SceneSettingsAction = 'save-scene-settings' | 'get-scene-settings'

/**
 * API error with structured information.
 */
export interface ApiError extends Error {
	readonly status: number
	readonly code?: string
}
