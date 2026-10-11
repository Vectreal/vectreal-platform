import { useCallback, useEffect, useRef, useState } from 'react'

import { useHeldExecutor } from './use-held-executor'

import type { AnimationPlaybackStatus } from '../components/scene'
import type {
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent
} from '../types/viewer-interactions'
import type { AnimationSettings } from '@vctrl/core'
import type { AnimationClip } from 'three'

const IDLE_STATUS: AnimationPlaybackStatus = {
	playing: false,
	complete: false,
	activeClipId: null,
	active: false
}

interface UseAnimationRuntimeOptions {
	animations?: AnimationClip[]
	options?: AnimationSettings
	/** Clears playback state when the viewer empties out. */
	hasContent: boolean
	/** The host's say over the built-in controls; the scene's settings still have to ask for them. */
	allowControls?: boolean
	/** Receives `animation_state_changed` whenever the status changes. */
	onInteractionEvent?: (event: ViewerInteractionEvent) => void
}

export interface AnimationRuntime {
	status: AnimationPlaybackStatus
	/** Whether the animation runtime should be mounted at all. */
	shouldMount: boolean
	/** Whether the built-in playback controls are drawn: the author opted in and the host allows it. */
	showControls: boolean
	registerExecutor: (executor: null | ViewerCommandExecutor) => void
	setStatus: (status: AnimationPlaybackStatus) => void
	forwardCommand: (command: ViewerCommand) => void
	toggle: () => void
	restart: () => void
}

/**
 * Holds the viewer root's animation wiring.
 *
 * Extracted so the root component does not accumulate another cluster of refs,
 * state and callbacks per feature. The runtime state lives here, and the root
 * only decides where to render the results.
 *
 * Status is tracked here rather than derived from `onInteractionEvent` so the
 * shadow swap and the playback chrome keep working whether or not a consumer
 * subscribes to events.
 */
export function useAnimationRuntime({
	animations,
	options,
	hasContent,
	allowControls = true,
	onInteractionEvent
}: UseAnimationRuntimeOptions): AnimationRuntime {
	const runtime = useHeldExecutor()
	const [status, setStatus] = useState<AnimationPlaybackStatus>(IDLE_STATUS)

	/*
	  `animation_state_changed` is announced from here, the one place that
	  tracks the status, rather than by the mixer component. That component
	  reports each change it makes but cannot report its own removal: when the
	  author turns animation off or the clips change, the status resets to idle
	  below, and nothing else would tell a host, whose own controls would then
	  show "pause" over a model that no longer moves. The idle status the viewer
	  starts in is not a change, so it is not announced. Compared by value: a
	  model swap unregisters and re-registers in one commit, and landing back on
	  the status a host already has is not news either.
	*/
	const onInteractionEventRef = useRef(onInteractionEvent)
	onInteractionEventRef.current = onInteractionEvent
	const announcedStatus = useRef(status)
	useEffect(() => {
		const announced = announcedStatus.current
		if (
			announced.playing === status.playing &&
			announced.complete === status.complete &&
			announced.activeClipId === status.activeClipId
		)
			return
		announcedStatus.current = status
		onInteractionEventRef.current?.({
			type: 'animation_state_changed',
			playing: status.playing,
			activeClipId: status.activeClipId,
			complete: status.complete
		})
	}, [status])

	useEffect(() => {
		if (!hasContent) setStatus(IDLE_STATUS)
	}, [hasContent])

	const registerExecutor = useCallback(
		(executor: null | ViewerCommandExecutor) => {
			runtime.register(executor)

			// Reset on unregister, which is the runtime going away: the canvas
			// unmounted on scroll, the author disabled animation, or the clips
			// changed. Without this the last known status outlives the runtime, and
			// it cannot self-heal on remount — a fresh runtime reports its state
			// only when it *differs* from the one it seeded, so a remount straight
			// back into "idle" is silent. That left the play button stuck showing
			// pause with no way to clear it, and pinned the shadow system to its
			// moving-geometry fallback indefinitely.
			if (!executor) setStatus(IDLE_STATUS)
		},
		[runtime]
	)

	const toggle = useCallback(() => {
		runtime.execute({
			type: 'set_animation_playing',
			playing: !status.playing
		})
	}, [runtime, status.playing])

	const restart = useCallback(() => {
		runtime.execute({ type: 'restart_animation' })
	}, [runtime])

	const hasClips = Boolean(animations && animations.length > 0)
	const shouldMount = hasClips && Boolean(options?.enabled)

	return {
		status,
		shouldMount,
		showControls:
			shouldMount && allowControls && Boolean(options?.showControls),
		registerExecutor,
		setStatus,
		forwardCommand: runtime.execute,
		toggle,
		restart
	}
}
