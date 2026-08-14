import { useCallback, useEffect, useRef, useState } from 'react'

import type { AnimationPlaybackStatus } from '../components/scene'
import type {
	ViewerCommand,
	ViewerCommandExecutor
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
}

export interface AnimationRuntime {
	status: AnimationPlaybackStatus
	/** Whether the animation runtime should be mounted at all. */
	shouldMount: boolean
	/** Whether the author opted into end-viewer playback controls. */
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
	hasContent
}: UseAnimationRuntimeOptions): AnimationRuntime {
	const executorRef = useRef<null | ViewerCommandExecutor>(null)
	const [status, setStatus] = useState<AnimationPlaybackStatus>(IDLE_STATUS)

	useEffect(() => {
		if (!hasContent) setStatus(IDLE_STATUS)
	}, [hasContent])

	const registerExecutor = useCallback(
		(executor: null | ViewerCommandExecutor) => {
			executorRef.current = executor
		},
		[]
	)

	const forwardCommand = useCallback((command: ViewerCommand) => {
		executorRef.current?.execute(command)
	}, [])

	const toggle = useCallback(() => {
		executorRef.current?.execute({
			type: 'set_animation_playing',
			playing: !status.playing
		})
	}, [status.playing])

	const restart = useCallback(() => {
		executorRef.current?.execute({ type: 'restart_animation' })
	}, [])

	const hasClips = Boolean(animations && animations.length > 0)
	const shouldMount = hasClips && Boolean(options?.enabled)

	return {
		status,
		shouldMount,
		showControls: shouldMount && Boolean(options?.showControls),
		registerExecutor,
		setStatus,
		forwardCommand,
		toggle,
		restart
	}
}
