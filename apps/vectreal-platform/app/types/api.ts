import type { User } from '@supabase/supabase-js'

import type {
	ControlsProps,
	EnvironmentProps,
	ShadowsProps,
	ToneMappingProps
} from '@vctrl/viewer'

import type {
	MetaState,
	ProcessState
} from '../lib/stores/publisher-config-store'

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
 * Scene settings request parameters.
 */
export interface SceneSettingsRequest {
	readonly action: string
	readonly sceneId: string
	readonly settings: Record<string, unknown>
	readonly assetIds: readonly string[]
}

/**
 * Parameters for saving scene settings.
 */
export interface SaveSceneSettingsParams {
	readonly sceneId: string
	readonly settings: Record<string, unknown>
	readonly assetIds: readonly string[]
	readonly userId: string
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
