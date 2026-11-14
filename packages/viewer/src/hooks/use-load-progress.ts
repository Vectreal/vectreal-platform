import { useEffect, useMemo, useRef } from 'react'

import type { ViewerInteractionEvent } from '../types/viewer-interactions'
import type { LoadProgress } from '@vctrl/core'

/**
 * Where the viewer's load is, as one value, for its loader and its host.
 *
 * Before there is a model it is the host's word (`loadProgress`: the
 * download and the parse, which happen outside the viewer) or `src`'s. Once
 * the model is here and the first frame is still being prepared, it is the
 * viewer's own `preparing`. It holds through the loader's fade, so the loader
 * does not change words on its way out, and is null once the loader is gone.
 *
 * Preparing carries no count. The only counter for what it waits on is
 * three's `DefaultLoadingManager`, which is global to the page and never
 * resets, so no load can be told its own files from it; and the one file it
 * mostly waits on, the environment map, makes a count of one.
 */
export function useViewerLoadProgress({
	hasContent,
	isLoading,
	hostProgress
}: {
	hasContent: boolean
	/** Whether the loader is on screen, its fade included. */
	isLoading: boolean
	hostProgress: LoadProgress | null | undefined
}): LoadProgress | null {
	// One object per change, so an effect keyed on it runs per change.
	return useMemo(() => {
		if (!isLoading) return null
		if (!hasContent) return hostProgress ?? null
		return PREPARING
	}, [hasContent, hostProgress, isLoading])
}

const PREPARING: LoadProgress = { phase: 'preparing' }

/** How often `load_progress` may repeat within one phase. */
export const LOAD_PROGRESS_EVENT_INTERVAL_MS = 250

/**
 * Tells the host where the load is: `model_loaded` once per model, the moment
 * it reaches the viewer, and `load_progress` on every phase change and at
 * most every quarter second within a phase. A value held back by the
 * interval is sent when it ends, so the last word of a phase always arrives.
 */
export function useLoadEvents({
	progress,
	modelIdentity,
	emit
}: {
	progress: LoadProgress | null
	/** What makes a model a new one: its key, or the object itself. */
	modelIdentity: unknown
	emit: (event: ViewerInteractionEvent) => void
}) {
	const emitRef = useRef(emit)
	useEffect(() => {
		emitRef.current = emit
	})

	// Remembered across StrictMode's second mount, so it still fires once;
	// forgotten when the model goes, so the same model coming back is news.
	const announced = useRef<unknown>(null)
	useEffect(() => {
		if (!modelIdentity) {
			announced.current = null
			return
		}
		if (announced.current === modelIdentity) return
		announced.current = modelIdentity
		emitRef.current({ type: 'model_loaded' })
	}, [modelIdentity])

	const last = useRef<{ phase: string; at: number } | null>(null)
	// A value held back by the interval, sent when it ends or before anything else.
	const held = useRef<{
		progress: LoadProgress
		timer: ReturnType<typeof setTimeout>
	} | null>(null)
	const send = (value: LoadProgress) => {
		last.current = { phase: value.phase, at: Date.now() }
		emitRef.current({ type: 'load_progress', progress: value })
	}
	const sendRef = useRef(send)
	useEffect(() => {
		sendRef.current = send
	})

	// The value last handled, so StrictMode's second run of the effect for the
	// same value does not send it again.
	const handled = useRef<LoadProgress | null>(null)
	useEffect(() => {
		if (progress && progress === handled.current) return
		handled.current = progress
		const pending = held.current
		if (pending) {
			clearTimeout(pending.timer)
			held.current = null
			// The last word of a phase that is ending, or of a load that ended.
			if (!progress || progress.phase !== pending.progress.phase) {
				sendRef.current(pending.progress)
			}
		}
		if (!progress) {
			last.current = null
			return
		}
		const previous = last.current
		const wait =
			previous && previous.phase === progress.phase
				? previous.at + LOAD_PROGRESS_EVENT_INTERVAL_MS - Date.now()
				: 0
		if (wait <= 0) {
			sendRef.current(progress)
			return
		}
		held.current = {
			progress,
			timer: setTimeout(() => {
				held.current = null
				sendRef.current(progress)
			}, wait)
		}
	}, [progress])

	useEffect(
		() => () => {
			if (held.current) clearTimeout(held.current.timer)
		},
		[]
	)
}
