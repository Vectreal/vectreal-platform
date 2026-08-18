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

/** Command that plays the animation program from the beginning. */
export interface RestartAnimationViewerCommand {
	type: 'restart_animation'
}

/**
 * Command that moves a single clip to a time offset.
 *
 * An authoring affordance. There is deliberately no equivalent for the whole
 * program: with several clips of differing length and rate, a global position
 * has no well-defined meaning.
 */
export interface SeekAnimationClipViewerCommand {
	type: 'seek_animation_clip'
	clipId: string
	time: number
}

/** Command that starts or suspends animation playback. */
export interface SetAnimationPlayingViewerCommand {
	type: 'set_animation_playing'
	playing: boolean
}

/** Minimal imperative command surface currently supported by the viewer runtime. */
export type ViewerCommand =
	| ActivateCameraViewerCommand
	| RestartAnimationViewerCommand
	| SeekAnimationClipViewerCommand
	| SetAnimationPlayingViewerCommand
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

/** Emitted whenever a single animation clip runs to its end. */
export interface AnimationClipFinishedInteractionEvent {
	type: 'animation_clip_finished'
	clipId: string
}

/** Emitted whenever the animation program starts, stops or advances. */
export interface AnimationStateChangedInteractionEvent {
	type: 'animation_state_changed'
	playing: boolean
	/** The clip driving a sequence; null in simultaneous mode. */
	activeClipId: null | string
	/** True once the program has run to its end without looping. */
	complete: boolean
}

/** Minimal event surface currently emitted by the viewer runtime. */
export type ViewerInteractionEvent =
	| AnimationClipFinishedInteractionEvent
	| AnimationStateChangedInteractionEvent
	| AutoRotateChangedInteractionEvent
	| CameraChangedInteractionEvent
	| InitialFramingCompletedInteractionEvent
	| ModelLoadedInteractionEvent
	| ViewerReadyInteractionEvent

/** App-facing imperative handle for executing viewer runtime commands. */
export interface ViewerCommandExecutor {
	execute: (command: ViewerCommand) => void
}
