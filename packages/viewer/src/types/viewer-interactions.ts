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

/** Minimal imperative command surface currently supported by the viewer runtime. */
export type ViewerCommand =
	| ActivateCameraViewerCommand
	| SetControlsEnabledViewerCommand

/** Emitted when the viewer command surface has been registered. */
export interface ViewerReadyInteractionEvent {
	type: 'viewer_ready'
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

/** Minimal event surface currently emitted by the viewer runtime. */
export type ViewerInteractionEvent =
	| CameraChangedInteractionEvent
	| InitialFramingCompletedInteractionEvent
	| ViewerReadyInteractionEvent

/** App-facing imperative handle for executing viewer runtime commands. */
export interface ViewerCommandExecutor {
	execute: (command: ViewerCommand) => void
}
