import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AnimationMixer, LoopOnce, LoopPingPong, LoopRepeat } from 'three'

import {
	initialPlaybackState,
	isProgramActive,
	reducePlayback
} from './animation-playback'
import { resolvePlaybackClips } from './resolve-playback-clips'

import type {
	PlaybackAction,
	PlaybackClip,
	PlaybackEffect,
	PlaybackState
} from './animation-playback'
import type {
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from '../../types/viewer-interactions'
import type { AnimationLoopMode, AnimationSettings } from '@vctrl/core'
import type { AnimationAction, AnimationClip, Object3D } from 'three'

/** Nothing plays until an author opts in. */
export const defaultAnimationOptions: AnimationSettings = {
	enabled: false,
	mode: 'simultaneous',
	autoplay: true,
	loopSequence: false,
	showControls: false,
	clips: []
}

/**
 * Ceiling on the per-frame step handed to the mixer.
 *
 * Not defensive padding. `CanvasWrapper` parks the render loop with
 * `frameloop="never"` while the tab is hidden, so the first delta after the tab
 * comes back can be many seconds. Fed straight to the mixer that would fire
 * `finished` on a short clip immediately, or run a whole sequence to its end,
 * in a single frame.
 */
const MAX_FRAME_DELTA = 1 / 15

/** The slice of playback the viewer shell needs in order to render. */
export interface AnimationPlaybackStatus {
	playing: boolean
	complete: boolean
	/** The clip driving a sequence; null in simultaneous mode. */
	activeClipId: null | string
	/** Whether model geometry is currently being driven. */
	active: boolean
}

interface SceneAnimationProps {
	/** The object the clips were parsed alongside. */
	model: Object3D
	animations: AnimationClip[]
	options?: AnimationSettings
	onCommandExecutorReady?: (executor: null | ViewerCommandExecutor) => void
	onInteractionEvent?: (event: ViewerInteractionEvent) => void
	onPlaybackStatusChange?: (status: AnimationPlaybackStatus) => void
}

function toThreeLoop(loop: AnimationLoopMode) {
	if (loop === 'once') return LoopOnce
	if (loop === 'ping_pong') return LoopPingPong
	return LoopRepeat
}

/**
 * Whether an action should hold its final pose rather than snapping back.
 *
 * Any clip that can actually end should clamp: without it three resets the
 * bound properties to the first frame the instant playback finishes, which
 * reads as the model twitching back to its rest pose.
 */
function shouldClamp(clip: PlaybackClip): boolean {
	return clip.loop === 'once' || typeof clip.repetitions === 'number'
}

function readStatus(state: PlaybackState): AnimationPlaybackStatus {
	return {
		playing: state.isPlaying,
		complete: state.isComplete,
		activeClipId:
			state.mode === 'sequence'
				? (state.clips[state.activeIndex]?.clipId ?? null)
				: null,
		active: isProgramActive(state)
	}
}

function isSameStatus(
	a: AnimationPlaybackStatus,
	b: AnimationPlaybackStatus
): boolean {
	return (
		a.playing === b.playing &&
		a.complete === b.complete &&
		a.activeClipId === b.activeClipId &&
		a.active === b.active
	)
}

/**
 * Drives the model's animation clips.
 *
 * Owns the four things that genuinely need three: the `AnimationMixer`, the
 * action map, the `finished` listener and the frame tick. Every sequencing
 * decision is delegated to `reducePlayback`, which is pure and unit-tested, so
 * this component only translates effects into mixer calls.
 *
 * Renders nothing.
 */
const SceneAnimation = (props: SceneAnimationProps) => {
	const {
		model,
		animations,
		options,
		onCommandExecutorReady,
		onInteractionEvent,
		onPlaybackStatusChange
	} = props

	const mixer = useMemo(() => new AnimationMixer(model), [model])

	const stateRef = useRef<PlaybackState>(initialPlaybackState())
	const statusRef = useRef<AnimationPlaybackStatus>(
		readStatus(initialPlaybackState())
	)
	const actionsRef = useRef(new Map<string, AnimationAction>())
	// Keyed by action rather than by clip name: glTF names are not unique, so a
	// name lookup could resolve a `finished` event onto the wrong config.
	const clipIdByActionRef = useRef(new WeakMap<AnimationAction, string>())
	const configureKeyRef = useRef<null | string>(null)

	// Read through refs so `dispatch` can stay referentially stable. An unstable
	// dispatch would churn the executor registration below, and the viewer root
	// unregisters with null on every re-run of that effect.
	const animationsRef = useRef(animations)
	animationsRef.current = animations
	const onInteractionEventRef = useRef(onInteractionEvent)
	onInteractionEventRef.current = onInteractionEvent
	const onPlaybackStatusChangeRef = useRef(onPlaybackStatusChange)
	onPlaybackStatusChangeRef.current = onPlaybackStatusChange

	const applyEffect = useCallback(
		(effect: PlaybackEffect) => {
			const actions = actionsRef.current

			switch (effect.type) {
				case 'start': {
					const clip = animationsRef.current[effect.clip.clipIndex]
					if (!clip) return

					const action = mixer.clipAction(clip)
					actions.set(effect.clip.clipId, action)
					clipIdByActionRef.current.set(action, effect.clip.clipId)

					action.reset()
					action.setLoop(
						toThreeLoop(effect.clip.loop),
						effect.clip.repetitions ?? Infinity
					)
					action.clampWhenFinished = shouldClamp(effect.clip)
					action.timeScale = effect.clip.timeScale
					// After reset(), so the offset is not overwritten.
					action.time = effect.clip.startOffset
					action.paused = false
					action.play()
					return
				}

				case 'retune': {
					const action = actions.get(effect.clip.clipId)
					if (!action) return

					// Position is deliberately untouched: this fires while an author
					// drags a slider, and resetting time would restart the clip.
					action.setLoop(
						toThreeLoop(effect.clip.loop),
						effect.clip.repetitions ?? Infinity
					)
					action.clampWhenFinished = shouldClamp(effect.clip)
					action.timeScale = effect.clip.timeScale
					return
				}

				case 'resume': {
					const action = actions.get(effect.clipId)
					if (action) action.paused = false
					return
				}

				case 'pause_all': {
					// Per action rather than `mixer.timeScale = 0`, which is global and
					// would also freeze the bookkeeping behind the `finished` event.
					for (const action of actions.values()) {
						action.paused = true
					}
					return
				}

				case 'stop': {
					const action = actions.get(effect.clipId)
					if (action) action.stop()
					actions.delete(effect.clipId)
					return
				}

				case 'stop_all': {
					mixer.stopAllAction()
					actions.clear()
					return
				}

				case 'seek': {
					const action = actions.get(effect.clipId)
					if (!action) return

					action.time = Math.min(
						Math.max(effect.time, 0),
						action.getClip().duration
					)
					// Push the new position onto the model without waiting a frame, so
					// scrubbing tracks the pointer.
					mixer.update(0)
					return
				}
			}
		},
		[mixer]
	)

	const dispatch = useCallback(
		(action: PlaybackAction) => {
			const { state, effects } = reducePlayback(stateRef.current, action)
			stateRef.current = state

			for (const effect of effects) {
				applyEffect(effect)
			}

			const status = readStatus(state)
			if (isSameStatus(status, statusRef.current)) return

			statusRef.current = status
			onPlaybackStatusChangeRef.current?.(status)
			onInteractionEventRef.current?.({
				type: 'animation_state_changed',
				playing: status.playing,
				activeClipId: status.activeClipId,
				complete: status.complete
			})
		},
		[applyEffect]
	)

	const clips = useMemo(
		() => resolvePlaybackClips(options, animations),
		[options, animations]
	)

	const mode = options?.mode ?? 'simultaneous'
	const loopSequence = options?.loopSequence ?? false
	// Read through a ref rather than a dependency: autoplay governs what the next
	// configure does, and treating it as a trigger would restart playback the
	// moment an author toggled it.
	const autoplayRef = useRef(options?.autoplay ?? true)
	autoplayRef.current = options?.autoplay ?? true

	useEffect(() => {
		// Distinguishing a structural change from a tuning change is what keeps the
		// authoring panel usable: without it, every frame of a speed-slider drag
		// would restart playback.
		const key = `${mode}|${loopSequence}|${clips.map((clip) => clip.clipId).join(',')}`

		if (configureKeyRef.current === key) {
			dispatch({ type: 'retune', clips })
			return
		}

		configureKeyRef.current = key
		dispatch({
			type: 'configure',
			clips,
			mode,
			loopSequence,
			autoplay: autoplayRef.current
		})
	}, [clips, dispatch, loopSequence, mode])

	useEffect(() => {
		const handleFinished = (event: { action: AnimationAction }) => {
			const clipId = clipIdByActionRef.current.get(event.action)
			if (!clipId) return

			onInteractionEventRef.current?.({
				type: 'animation_clip_finished',
				clipId
			})
			dispatch({ type: 'clip_finished', clipId })
		}

		mixer.addEventListener('finished', handleFinished)

		return () => {
			mixer.removeEventListener('finished', handleFinished)
		}
	}, [dispatch, mixer])

	useEffect(() => {
		const root = model

		return () => {
			mixer.stopAllAction()
			mixer.uncacheRoot(root)
			actionsRef.current.clear()
			// Force the next pass to configure: the incoming mixer has no actions,
			// so a retune against a matching key would silently play nothing.
			configureKeyRef.current = null
			stateRef.current = initialPlaybackState()
		}
	}, [mixer, model])

	const executeViewerCommand = useCallback(
		(command: ViewerCommand) => {
			switch (command.type) {
				case 'set_animation_playing':
					dispatch({ type: command.playing ? 'play' : 'pause' })
					return
				case 'restart_animation':
					dispatch({ type: 'restart' })
					return
				case 'seek_animation_clip':
					dispatch({
						type: 'seek_clip',
						clipId: command.clipId,
						time: command.time
					})
					return
				default:
					return
			}
		},
		[dispatch]
	)

	useEffect(() => {
		onCommandExecutorReady?.({ execute: executeViewerCommand })

		return () => {
			onCommandExecutorReady?.(null)
		}
	}, [executeViewerCommand, onCommandExecutorReady])

	useFrame((_, delta) => {
		mixer.update(Math.min(delta, MAX_FRAME_DELTA))
	})

	return null
}

export default SceneAnimation
