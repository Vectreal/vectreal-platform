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

/**
 * Command that focuses a single hotspot: reveals whatever it has to say and
 * flies its linked camera, exactly as clicking the marker would.
 *
 * For a host driving its own navigation from the hotspot descriptors in the
 * handshake. Naming a hotspot that is not drawn - one the author hid or kept
 * internal - does nothing, so a stale host list cannot reach a marker a
 * visitor is not allowed to see.
 */
export interface FocusHotspotViewerCommand {
	type: 'focus_hotspot'
	hotspotId: string
}

/**
 * Command that leaves a hotspot's camera for the scene camera the visitor was
 * on before it, or the scene's default when there was none - what the viewer's
 * own "Back to scene view" control does.
 *
 * Does nothing while the view is not at a hotspot, so a host can send it
 * without tracking where the camera is.
 */
export interface ReturnToSceneViewViewerCommand {
	type: 'return_to_scene_view'
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
	| FocusHotspotViewerCommand
	| RestartAnimationViewerCommand
	| ReturnToSceneViewViewerCommand
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

/**
 * Emitted when a visitor activates a hotspot.
 *
 * The host already sees `camera_changed` when a marker flies its camera, but
 * not which marker caused it - and a marker that only reveals content moves no
 * camera at all, so nothing reached the host for it. `cameraId` is null for
 * exactly that case.
 *
 * Never emitted for a selection: that is an editing surface picking a marker
 * up, not a visitor doing anything with it.
 */
export interface HotspotActivatedInteractionEvent {
	type: 'hotspot_activated'
	hotspotId: string
	cameraId: null | string
}

/**
 * Emitted when the scene's environment map could not be loaded.
 *
 * The scene stays lit, by a local room instead, so nothing on screen fails and
 * nothing else tells a host: the lighting and backdrop the author chose are
 * simply not what a visitor sees. Emitted each time a map is shown and fails;
 * the viewer tries the map again the next time it is shown, and
 * `environment_loaded` follows if it then arrives.
 */
export interface EnvironmentLoadFailedInteractionEvent {
	type: 'environment_load_failed'
	/** The map's file or files, as the scene's environment settings resolve them. */
	files: string[]
}

/**
 * Emitted each time the scene's environment map is shown and lights the
 * scene, including after an earlier `environment_load_failed` for it.
 */
export interface EnvironmentLoadedInteractionEvent {
	type: 'environment_loaded'
	/** The map's file or files, as the scene's environment settings resolve them. */
	files: string[]
}

/**
 * Emitted when the browser takes the viewer's WebGL context away, which a
 * phone does when the page runs short of graphics memory. The canvas is blank
 * from this moment; `context_restored` follows if the browser hands a context
 * back, and `render_failed` if it does not.
 */
export interface ContextLostInteractionEvent {
	type: 'context_lost'
}

/**
 * Emitted when the browser hands a WebGL context back after `context_lost`.
 * The viewer redraws the scene it already holds, without loading it again.
 */
export interface ContextRestoredInteractionEvent {
	type: 'context_restored'
}

/**
 * Emitted when the viewer stops trying to draw and shows that the scene could
 * not be shown: the context was not restored in time, or was lost again soon
 * after a restore. A visitor can still ask for another try.
 */
export interface RenderFailedInteractionEvent {
	type: 'render_failed'
	reason: 'context_lost'
}

/**
 * Emitted when the viewer draws a contact shadow in place of baking the
 * ground shadow live, because the scene has no valid stored bake and the
 * viewer was asked to stay within budget (`liveShadowBake="within-budget"`).
 * Publishing the scene again stores a bake every device shows.
 */
export interface ShadowBakeSkippedInteractionEvent {
	type: 'shadow_bake_skipped'
	/** A phone or tablet, or more draw calls per bake frame than the budget. */
	reason: 'touch_device' | 'over_budget'
	/** Draw calls one bake frame would have issued. */
	estimatedDraws: number
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
	| ContextLostInteractionEvent
	| ContextRestoredInteractionEvent
	| EnvironmentLoadFailedInteractionEvent
	| EnvironmentLoadedInteractionEvent
	| HotspotActivatedInteractionEvent
	| InitialFramingCompletedInteractionEvent
	| ModelLoadedInteractionEvent
	| RenderFailedInteractionEvent
	| ShadowBakeSkippedInteractionEvent
	| ViewerReadyInteractionEvent

/** App-facing imperative handle for executing viewer runtime commands. */
export interface ViewerCommandExecutor {
	execute: (command: ViewerCommand) => void
}
