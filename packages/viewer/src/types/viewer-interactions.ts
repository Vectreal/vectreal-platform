/** Command that requests a transition to one of the configured viewer cameras. */
export interface ActivateCameraViewerCommand {
	type: 'activate_camera'
	cameraId: string
}

/** Command that temporarily enables or disables viewer controls at runtime. */
export interface SetControlsEnabledViewerCommand {
	type: 'set_controls_enabled'
	enabled: boolean
}

/** Command that overrides the transition behaviour for the next camera switch. */
export interface SetTransitionViewerCommand {
	type: 'set_transition'
	transitionType: 'none' | 'linear' | 'object_avoidance'
	duration?: number
	easing?: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out'
}

/** Command that toggles auto-rotate independently of stored scene settings. */
export interface SetAutoRotateViewerCommand {
	type: 'set_auto_rotate'
	enabled: boolean
	speed?: number
}

/** Command that toggles zoom and pan at runtime. */
export interface SetControlsOptionsViewerCommand {
	type: 'set_controls_options'
	zoom?: boolean
	pan?: boolean
}

/** Minimal imperative command surface currently supported by the viewer runtime. */
export type ViewerCommand =
	| ActivateCameraViewerCommand
	| SetAutoRotateViewerCommand
	| SetControlsEnabledViewerCommand
	| SetControlsOptionsViewerCommand
	| SetTransitionViewerCommand

/** Emitted when the viewer command surface has been registered. */
export interface ViewerReadyInteractionEvent {
	type: 'viewer_ready'
}

/** Emitted once the model file finishes loading (before initial framing). */
export interface ModelLoadedInteractionEvent {
	type: 'model_loaded'
}

/** Emitted after the viewer finishes its initial framing/stabilization pass. */
export interface InitialFramingCompletedInteractionEvent {
	type: 'initial_framing_completed'
	cameraId: null | string
}

/** Emitted whenever the active camera selection changes. */
export interface CameraChangedInteractionEvent {
	type: 'camera_changed'
	cameraId: string
}

/** Emitted when auto-rotate state changes at runtime. */
export interface AutoRotateChangedInteractionEvent {
	type: 'auto_rotate_changed'
	enabled: boolean
}

/** Minimal event surface currently emitted by the viewer runtime. */
export type ViewerInteractionEvent =
	| AutoRotateChangedInteractionEvent
	| CameraChangedInteractionEvent
	| InitialFramingCompletedInteractionEvent
	| ModelLoadedInteractionEvent
	| ViewerReadyInteractionEvent

/** App-facing imperative handle for executing viewer runtime commands. */
export interface ViewerCommandExecutor {
	execute: (command: ViewerCommand) => void
}
