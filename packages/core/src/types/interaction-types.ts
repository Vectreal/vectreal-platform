import type { CameraProps } from './scene-types'

/** Declares whether an interaction is driven by the host page or by viewer lifecycle. */
export type SceneInteractionSource = 'host' | 'viewer'

/** Fires once when the viewer runtime becomes ready to receive commands. */
export interface ViewerReadyTrigger {
	source: 'viewer'
	type: 'viewer_ready'
}

/** Fires when the host page reports scroll progress inside the configured range. */
export interface HostScrollProgressTrigger {
	source: 'host'
	type: 'host_scroll_progress'
	start: number
	end: number
}

/** Fires when the host page sends a named embed message into the viewer bridge. */
export interface HostMessageTrigger {
	source: 'host'
	type: 'host_message'
	message: string
}

/** Serializable trigger contract persisted with scene settings. */
export type SceneInteractionTrigger =
	| HostMessageTrigger
	| HostScrollProgressTrigger
	| ViewerReadyTrigger

/** Imperatively activates one of the persisted scene cameras. */
export interface ActivateCameraAction {
	type: 'activate_camera'
	cameraId: string
}

/** Enables or disables viewer controls at runtime. */
export interface SetControlsEnabledAction {
	type: 'set_controls_enabled'
	enabled: boolean
}

/** Emits a host-observable custom event without mutating viewer state directly. */
export interface EmitCustomEventAction {
	type: 'emit_custom_event'
	eventName: string
	payload?: Record<string, unknown>
}

/** Serializable action contract persisted with scene settings. */
export type SceneInteractionAction =
	| ActivateCameraAction
	| EmitCustomEventAction
	| SetControlsEnabledAction

/** One ordered, optionally disabled interaction rule persisted with a scene. */
export interface SceneInteractionDefinition {
	id?: string
	order?: number
	enabled?: boolean
	trigger: SceneInteractionTrigger
	actions: SceneInteractionAction[]
}

/** Optional normalization context used to validate scene interaction references. */
export interface NormalizeSceneInteractionsOptions {
	camera?: CameraProps
}
