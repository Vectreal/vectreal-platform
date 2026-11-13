import { useProgress } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'

import type { ViewerInteractionEvent } from '../types/viewer-interactions'
import type { LoadProgress } from '@vctrl/core'

/**
 * Where the viewer's load is, as one value, for its loader and its host.
 *
 * Before there is a model it is the host's word (`loadProgress`: the
 * download and the parse, which happen outside the viewer) or `src`'s. Once
 * the model is here and the first frame is still being prepared, it is the
 * viewer's own `preparing`, counting the environment's files. It holds
 * through the loader's fade, so the loader does not change words on its way
 * out, and is null once the loader is gone.
 *
 * The count comes from drei's `useProgress`, which reads three's global
 * `DefaultLoadingManager`. A model's own parse runs through a manager of its
 * own (`ModelLoader`), so what is counted there is the environment and any
 * texture the scene loads, which is what preparing waits on. Only while that
 * manager is active: its counters are never reset, so after a load they still
 * read the last one's total.
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
	const preparing = hasContent && isLoading
	// A key rather than the store, so a page loading textures elsewhere does
	// not re-render the viewer once it is ready.
	const files = useProgress((state) =>
		preparing && state.active && state.total > 0
			? `${state.loaded}/${state.total}`
			: ''
	)

	// One object per change, so an effect keyed on it runs per change.
	return useMemo(() => {
		if (!isLoading) return null
		if (!hasContent) return hostProgress ?? null
		if (!files) return { phase: 'preparing' }
		const [loaded, total] = files.split('/').map(Number)
		return { phase: 'preparing', items: { loaded, total } }
	}, [files, hasContent, hostProgress, isLoading])
}

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

	// Remembered across StrictMode's second mount, so it still fires once.
	const announced = useRef<unknown>(null)
	useEffect(() => {
		if (!modelIdentity || announced.current === modelIdentity) return
		announced.current = modelIdentity
		emitRef.current({ type: 'model_loaded' })
	}, [modelIdentity])

	const last = useRef<{ phase: string; at: number } | null>(null)
	useEffect(() => {
		if (!progress) {
			last.current = null
			return
		}
		const send = () => {
			last.current = { phase: progress.phase, at: Date.now() }
			emitRef.current({ type: 'load_progress', progress })
		}
		const previous = last.current
		const wait =
			previous && previous.phase === progress.phase
				? previous.at + LOAD_PROGRESS_EVENT_INTERVAL_MS - Date.now()
				: 0
		if (wait <= 0) {
			send()
			return
		}
		// A newer value replaces this one before it is sent.
		const timer = setTimeout(send, wait)
		return () => clearTimeout(timer)
	}, [progress])
}
