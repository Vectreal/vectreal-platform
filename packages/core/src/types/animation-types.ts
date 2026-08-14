/** How a single clip repeats once started. */
export type AnimationLoopMode = 'once' | 'ping_pong' | 'repeat'

/**
 * How enabled clips relate to each other.
 * - 'simultaneous': every enabled clip plays at once, each on its own loop.
 * - 'sequence': clips play one after another in `order`.
 */
export type AnimationPlaybackMode = 'sequence' | 'simultaneous'

/** Per-clip playback configuration persisted with scene settings. */
export interface AnimationClipConfig {
	/**
	 * Stable reference produced by `deriveAnimationClipId`. Unique within one
	 * settings object. Survives clip reordering inside the glTF file because it
	 * is derived from the name rather than the position.
	 */
	clipId: string
	/**
	 * The glTF clip name this config was authored against, empty for an unnamed
	 * clip. Kept for display and for explaining a reconciliation to the author.
	 */
	sourceName: string
	/**
	 * Clip index at authoring time. The fallback used to re-attach a config after
	 * a clip has been renamed in the source file.
	 */
	sourceIndex: number
	/** Whether this clip takes part in playback. */
	enabled: boolean
	/** Dense 0-based position in the sequence chain. Ignored in simultaneous mode. */
	order: number
	loop: AnimationLoopMode
	/**
	 * Finite repeat count for 'repeat' and 'ping_pong'. Absent means infinite.
	 * Ignored for 'once'.
	 */
	repetitions?: number
	/** Playback rate multiplier. Always greater than zero. */
	timeScale: number
	/** Seconds into the clip at which playback begins. Never negative. */
	startOffset: number
}

/** Scene-level animation configuration persisted with scene settings. */
export interface AnimationSettings {
	/** Master switch. When false no animation runtime is mounted at all. */
	enabled: boolean
	mode: AnimationPlaybackMode
	/** Start playing as soon as the model is ready. */
	autoplay: boolean
	/** Restart the chain after the last clip finishes. Sequence mode only. */
	loopSequence: boolean
	/** Author opt-in for playback controls in published and embedded scenes. */
	showControls: boolean
	clips: AnimationClipConfig[]
}
