import { useCallback, useEffect, useRef, useState } from 'react'

import type {
	ContextLostInteractionEvent,
	ContextRestoredInteractionEvent,
	RenderFailedInteractionEvent
} from '../types/viewer-interactions'

/** How long the browser gets to hand a lost context back before the viewer gives up. */
export const CONTEXT_RESTORE_TIMEOUT_MS = 3_000

/**
 * A second loss inside this window gives up at once. A phone that drops the
 * context again right after restoring it will keep doing so with the same
 * scene, and redrawing into it would only blank the canvas on a loop.
 */
export const REPEATED_CONTEXT_LOSS_WINDOW_MS = 60_000

export type ContextLossEvent =
	| ContextLostInteractionEvent
	| ContextRestoredInteractionEvent
	| RenderFailedInteractionEvent

export interface ContextLossRecovery {
	/** Key for the canvas, bumped to mount a fresh one with a fresh context. */
	canvasKey: number
	/** True once the viewer has stopped trying and should say so. */
	failed: boolean
	onContextLost: (event: Event) => void
	onContextRestored: () => void
	/**
	 * The canvas went away for some other reason - out of view, say. Its
	 * restore can no longer be heard, and the next mount brings a fresh context
	 * anyway, so a pending give-up is dropped rather than left to fire.
	 */
	onCanvasUnmount: () => void
	/** Clears the failure and mounts a fresh canvas. */
	retry: () => void
}

/**
 * What the viewer does when the browser takes its WebGL context away.
 *
 * A restored context is answered with a fresh canvas rather than three's own
 * in-place restore: every GPU resource is rebuilt from the scene the viewer
 * still holds (model, textures, environment are all in memory or the loader
 * caches), and nothing the canvas subtree computed - a shadow bake, the
 * composer's buffers - can survive a lost context anyway.
 *
 * `onEvent` is read through a ref, so an inline callback is fine.
 */
export function useContextLossRecovery(
	onEvent?: (event: ContextLossEvent) => void
): ContextLossRecovery {
	const [canvasKey, setCanvasKey] = useState(0)
	const [failed, setFailed] = useState(false)
	const onEventRef = useRef(onEvent)
	onEventRef.current = onEvent
	const lastLossAtRef = useRef<null | number>(null)
	const restoreTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null)

	const clearRestoreTimer = () => {
		if (restoreTimerRef.current !== null) {
			clearTimeout(restoreTimerRef.current)
			restoreTimerRef.current = null
		}
	}

	const giveUp = useCallback(() => {
		clearRestoreTimer()
		setFailed(true)
		onEventRef.current?.({ type: 'render_failed', reason: 'context_lost' })
	}, [])

	const onContextLost = useCallback(
		(event: Event) => {
			// Without this the browser never offers the context back.
			event.preventDefault()
			onEventRef.current?.({ type: 'context_lost' })

			const now = Date.now()
			const lastLossAt = lastLossAtRef.current
			lastLossAtRef.current = now
			if (
				lastLossAt !== null &&
				now - lastLossAt < REPEATED_CONTEXT_LOSS_WINDOW_MS
			) {
				giveUp()
				return
			}
			clearRestoreTimer()
			restoreTimerRef.current = setTimeout(giveUp, CONTEXT_RESTORE_TIMEOUT_MS)
		},
		[giveUp]
	)

	const onContextRestored = useCallback(() => {
		clearRestoreTimer()
		onEventRef.current?.({ type: 'context_restored' })
		setCanvasKey((key) => key + 1)
	}, [])

	const onCanvasUnmount = useCallback(() => clearRestoreTimer(), [])

	const retry = useCallback(() => {
		clearRestoreTimer()
		lastLossAtRef.current = null
		setFailed(false)
		setCanvasKey((key) => key + 1)
	}, [])

	useEffect(() => clearRestoreTimer, [])

	return {
		canvasKey,
		failed,
		onContextLost,
		onContextRestored,
		onCanvasUnmount,
		retry
	}
}
