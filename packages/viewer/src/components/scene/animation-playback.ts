import type { AnimationLoopMode, AnimationPlaybackMode } from '@vctrl/core'

/**
 * One clip resolved against the loaded model and ready to play.
 *
 * Produced by `resolve-playback-clips`, which has already dropped anything
 * disabled, unmatched or zero-length, so every entry here is playable.
 */
export interface PlaybackClip {
	clipId: string
	/** Index into the viewer's `AnimationClip[]`. */
	clipIndex: number
	duration: number
	loop: AnimationLoopMode
	/** Absent means infinite. */
	repetitions?: number
	timeScale: number
	startOffset: number
}

export interface PlaybackState {
	mode: AnimationPlaybackMode
	clips: PlaybackClip[]
	loopSequence: boolean
	isPlaying: boolean
	/** Index into `clips` in sequence mode; -1 in simultaneous mode. */
	activeIndex: number
	/** Clip ids that have run to their end. Only meaningful in simultaneous mode. */
	completed: string[]
	/** True once the whole program has finished without looping. */
	isComplete: boolean
	/**
	 * Whether actions exist to resume. Distinguishes "paused mid-playback" from
	 * "configured but never started", which need `resume` and `start` respectively.
	 */
	hasStarted: boolean
}

export type PlaybackAction =
	| { type: 'clip_finished'; clipId: string }
	| {
			type: 'configure'
			clips: PlaybackClip[]
			mode: AnimationPlaybackMode
			loopSequence: boolean
			autoplay: boolean
	  }
	| { type: 'pause' }
	| { type: 'play' }
	| { type: 'restart' }
	| { type: 'retune'; clips: PlaybackClip[] }
	| { type: 'seek_clip'; clipId: string; time: number }
	| { type: 'toggle' }

export type PlaybackEffect =
	| { type: 'pause_all' }
	| { type: 'resume'; clipId: string }
	| { type: 'retune'; clip: PlaybackClip }
	| { type: 'seek'; clipId: string; time: number }
	| { type: 'start'; clip: PlaybackClip }
	| { type: 'stop'; clipId: string }
	| { type: 'stop_all' }

export interface PlaybackTransition {
	state: PlaybackState
	effects: PlaybackEffect[]
}

export function initialPlaybackState(): PlaybackState {
	return {
		mode: 'simultaneous',
		clips: [],
		loopSequence: false,
		isPlaying: false,
		activeIndex: -1,
		completed: [],
		isComplete: false,
		hasStarted: false
	}
}

/** Whether the model's geometry is currently being driven. */
export function isProgramActive(state: PlaybackState): boolean {
	return state.isPlaying && state.clips.length > 0
}

/** Starts the program from the beginning, in whichever mode is configured. */
function startFromBeginning(state: PlaybackState): PlaybackTransition {
	if (state.clips.length === 0) {
		return {
			state: {
				...state,
				isPlaying: false,
				activeIndex: -1,
				completed: [],
				isComplete: false,
				hasStarted: false
			},
			effects: [{ type: 'stop_all' }]
		}
	}

	const effects: PlaybackEffect[] = [{ type: 'stop_all' }]

	if (state.mode === 'sequence') {
		effects.push({ type: 'start', clip: state.clips[0] as PlaybackClip })
	} else {
		for (const clip of state.clips) {
			effects.push({ type: 'start', clip })
		}
	}

	return {
		state: {
			...state,
			isPlaying: true,
			activeIndex: state.mode === 'sequence' ? 0 : -1,
			completed: [],
			isComplete: false,
			hasStarted: true
		},
		effects
	}
}

function advanceSequence(state: PlaybackState): PlaybackTransition {
	const current = state.clips[state.activeIndex]
	const next = state.clips[state.activeIndex + 1]

	if (next) {
		return {
			state: { ...state, activeIndex: state.activeIndex + 1 },
			effects: [
				...(current ? [{ type: 'stop' as const, clipId: current.clipId }] : []),
				{ type: 'start', clip: next }
			]
		}
	}

	if (state.loopSequence) {
		return {
			state: { ...state, activeIndex: 0, completed: [] },
			effects: [
				...(current ? [{ type: 'stop' as const, clipId: current.clipId }] : []),
				{ type: 'start', clip: state.clips[0] as PlaybackClip }
			]
		}
	}

	// Emit nothing on the way out: the final clip was configured to clamp, so
	// leaving it alone holds the closing pose instead of snapping back to rest.
	return {
		state: { ...state, isPlaying: false, isComplete: true },
		effects: []
	}
}

function completeSimultaneous(
	state: PlaybackState,
	clipId: string
): PlaybackTransition {
	if (state.completed.includes(clipId)) {
		return { state, effects: [] }
	}

	const completed = [...state.completed, clipId]
	// A program holding any infinite clip can never reach this count, which is
	// the intended behavior: it genuinely never ends.
	const isComplete = completed.length >= state.clips.length

	return {
		state: {
			...state,
			completed,
			isComplete,
			isPlaying: isComplete ? false : state.isPlaying
		},
		effects: []
	}
}

/**
 * The whole playback program, as a pure reducer.
 *
 * Kept free of three so the sequencing rules can be tested without a WebGL
 * context. The component owning the `AnimationMixer` applies the returned
 * effects and is the only place that touches three.
 */
export function reducePlayback(
	state: PlaybackState,
	action: PlaybackAction
): PlaybackTransition {
	switch (action.type) {
		case 'configure': {
			// Always tear down first. A configure can arrive because the model
			// changed, and actions bound to the previous graph must not survive it.
			const next: PlaybackState = {
				...initialPlaybackState(),
				mode: action.mode,
				clips: action.clips,
				loopSequence: action.loopSequence
			}

			if (action.autoplay) {
				return startFromBeginning(next)
			}

			return {
				state: {
					...next,
					activeIndex: action.mode === 'sequence' && action.clips.length ? 0 : -1
				},
				effects: [{ type: 'stop_all' }]
			}
		}

		case 'retune': {
			// Tuning-only update. Deliberately does not restart: this is what a
			// speed or offset slider emits, and restarting on every drag frame
			// would make the authoring panel unusable.
			const byId = new Map(action.clips.map((clip) => [clip.clipId, clip]))

			return {
				state: {
					...state,
					clips: state.clips.map((clip) => byId.get(clip.clipId) ?? clip)
				},
				effects: state.clips
					.map((clip) => byId.get(clip.clipId))
					.filter((clip): clip is PlaybackClip => Boolean(clip))
					.map((clip) => ({ type: 'retune' as const, clip }))
			}
		}

		case 'restart':
			return startFromBeginning(state)

		case 'play': {
			if (state.clips.length === 0) return { state, effects: [] }

			// A finished program's play button means "again", not "resume at the end".
			if (state.isComplete || !state.hasStarted) {
				return startFromBeginning(state)
			}

			if (state.isPlaying) return { state, effects: [] }

			const resuming =
				state.mode === 'sequence'
					? [state.clips[state.activeIndex]].filter(Boolean)
					: state.clips

			return {
				state: { ...state, isPlaying: true },
				effects: (resuming as PlaybackClip[]).map((clip) => ({
					type: 'resume' as const,
					clipId: clip.clipId
				}))
			}
		}

		case 'pause': {
			if (!state.isPlaying) return { state, effects: [] }

			return {
				state: { ...state, isPlaying: false },
				effects: [{ type: 'pause_all' }]
			}
		}

		case 'toggle':
			return reducePlayback(state, { type: state.isPlaying ? 'pause' : 'play' })

		case 'clip_finished': {
			if (!state.isPlaying) return { state, effects: [] }

			if (state.mode === 'sequence') {
				// Guard against a stale event from a program that has since been
				// reconfigured: only the clip currently holding the chain advances it.
				const active = state.clips[state.activeIndex]
				if (!active || active.clipId !== action.clipId) {
					return { state, effects: [] }
				}

				return advanceSequence(state)
			}

			if (!state.clips.some((clip) => clip.clipId === action.clipId)) {
				return { state, effects: [] }
			}

			return completeSimultaneous(state, action.clipId)
		}

		case 'seek_clip':
			return {
				state,
				effects: [
					{ type: 'seek', clipId: action.clipId, time: action.time }
				]
			}

		default:
			return { state, effects: [] }
	}
}
