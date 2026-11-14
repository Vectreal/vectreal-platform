import { formatFileSize } from '@shared/utils'
import { useEffect, useState } from 'react'

/**
 * Where a model load is. The same shape as `LoadProgress` in `@vctrl/core`,
 * written out here because shared components do not depend on the packages
 * that load models; the two are kept equal by structure, so a value from
 * either side fits.
 */
export interface LoadProgressValue {
	phase: 'fetching' | 'parsing' | 'preparing'
	bytes?: { loaded: number; total: number | null }
	items?: { loaded: number; total: number }
}

/**
 * The words a load is described in, so the viewer can pass its own language.
 * Each phase has a title; the detail carries the numbers.
 */
export interface LoadProgressWords {
	/** The title while nothing is known yet about the load. */
	loading: string
	/** The download's title; `subject` is what is being downloaded, when named. */
	fetching: (subject?: string) => string
	parsing: string
	preparing: string
	/** "4.2 MB of 13 MB", or "4.2 MB" when the total is unknown. */
	bytes: (loaded: string, total: string | null) => string
	/** "3 of 8 files". */
	items: (loaded: number, total: number) => string
}

export const LOAD_PROGRESS_WORDS: LoadProgressWords = {
	loading: 'Loading',
	fetching: (subject) => (subject ? `Downloading ${subject}` : 'Downloading'),
	parsing: 'Reading the model',
	preparing: 'Preparing the scene',
	bytes: (loaded, total) => (total ? `${loaded} of ${total}` : loaded),
	items: (loaded, total) => `${loaded} of ${total} files`
}

/** How long a load runs before its progress appears, so a fast one draws nothing. */
export const LOAD_PROGRESS_DELAY_MS = 300

export interface LoadProgressDescription {
	/** The phase, in words: the only part a screen reader is told as it changes. */
	title: string
	/** The numbers under it, or null when there are none to give. */
	detail: string | null
	/**
	 * 0 to 100 while a download's size is known, otherwise null. Never from a
	 * file count: its total grows as the parser finds files, so it is not a
	 * fraction of anything.
	 */
	percent: number | null
}

/**
 * The one reading of a load's progress, for every renderer of it. Shared
 * without markup because the published viewer can only style its own `vv:`
 * classes: the app and the viewer each draw this description their way.
 */
export function describeLoadProgress(
	progress: LoadProgressValue | null | undefined,
	words: LoadProgressWords = LOAD_PROGRESS_WORDS,
	subject?: string
): LoadProgressDescription {
	const phase = progress?.phase
	const bytes = phase === 'fetching' ? progress?.bytes : undefined
	// A declared size the body outgrew was not the size, so it is dropped.
	const total =
		bytes?.total && bytes.total > 0 && bytes.loaded <= bytes.total
			? bytes.total
			: null
	const items = phase === 'fetching' ? undefined : progress?.items

	const title =
		phase === 'fetching'
			? words.fetching(subject)
			: phase === 'parsing'
				? words.parsing
				: phase === 'preparing'
					? words.preparing
					: words.loading

	const detail = bytes
		? words.bytes(
				formatFileSize(bytes.loaded),
				total ? formatFileSize(total) : null
			)
		: items && items.total > 0
			? words.items(items.loaded, items.total)
			: null

	return {
		title,
		detail,
		// Floored, so nothing reads 100 while bytes are still arriving.
		percent: bytes && total ? Math.floor((bytes.loaded / total) * 100) : null
	}
}

/**
 * False until `delayMs` has passed since mount, then true for good. A delay of
 * 0 or less, or one shortened past the time already waited, shows at once.
 */
export function useDelayedVisible(delayMs: number = LOAD_PROGRESS_DELAY_MS) {
	const [mountedAt] = useState(() => Date.now())
	const [visible, setVisible] = useState(delayMs <= 0)
	useEffect(() => {
		if (visible) return
		const remaining = mountedAt + delayMs - Date.now()
		if (remaining <= 0) {
			setVisible(true)
			return
		}
		const timer = setTimeout(() => setVisible(true), remaining)
		return () => clearTimeout(timer)
	}, [delayMs, mountedAt, visible])
	return visible
}
