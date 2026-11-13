import { cn, formatFileSize } from '@shared/utils'
import { useEffect, useState } from 'react'

import { ProgressRing } from './progress-ring'

import type { FC } from 'react'

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
 * The indicator's words, so the viewer can pass its own language. Each
 * phase has a title, and the detail line under it carries the numbers.
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

/** How long a load runs before the indicator appears, so a fast one draws nothing. */
export const LOAD_PROGRESS_DELAY_MS = 300

interface LoadProgressIndicatorProps {
	/** Absent while nothing is known yet: the ring turns and the title says only "Loading". */
	progress?: LoadProgressValue | null
	/** What is loading, for the download's title: "Downloading Rocket". */
	subject?: string
	words?: LoadProgressWords
	/** Milliseconds before it shows. */
	delayMs?: number
	/**
	 * Whether the title is a live region of its own. False inside a container
	 * that already is one, such as the viewer's loading overlay, so the title
	 * is not announced twice.
	 */
	announce?: boolean
	className?: string
}

/**
 * The one progress pattern for every place a model loads: the Publisher's
 * stage, the converter, and the viewer's own loader.
 *
 * A ring and two lines, as the save panel draws its progress. The ring
 * measures only what can be measured, the bytes of a download with a known
 * size; parsing and preparing turn it indeterminate rather than invent a
 * percentage, and their counts go in the line under the title.
 *
 * No box around it: it sits on whatever the caller draws behind it, which is
 * usually the scene's own thumbnail.
 */
export const LoadProgressIndicator: FC<LoadProgressIndicatorProps> = ({
	progress,
	subject,
	words = LOAD_PROGRESS_WORDS,
	delayMs = LOAD_PROGRESS_DELAY_MS,
	announce = true,
	className
}) => {
	const [shown, setShown] = useState(delayMs <= 0)
	useEffect(() => {
		if (delayMs <= 0) return
		const timer = setTimeout(() => setShown(true), delayMs)
		return () => clearTimeout(timer)
	}, [delayMs])

	const phase = progress?.phase
	const bytes = phase === 'fetching' ? progress?.bytes : undefined
	const items = phase === 'fetching' ? undefined : progress?.items
	const percent =
		bytes?.total && bytes.total > 0
			? Math.min(100, (bytes.loaded / bytes.total) * 100)
			: null

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
				bytes.total ? formatFileSize(bytes.total) : null
			)
		: items && items.total > 0
			? words.items(items.loaded, items.total)
			: null

	return (
		<div
			className={cn(
				'flex flex-col items-center justify-center gap-3 text-center',
				!shown && 'invisible',
				className
			)}
		>
			<span
				role="progressbar"
				aria-label={title}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={percent === null ? undefined : Math.round(percent)}
			>
				<ProgressRing value={percent} className="text-orange size-7" />
			</span>
			<span className="grid gap-0.5">
				{/* Announced when the phase changes, never at each percent. */}
				<span
					aria-live={announce ? 'polite' : undefined}
					className="text-sm font-medium"
				>
					{shown ? title : ''}
				</span>
				<span
					aria-hidden
					className="text-muted-foreground min-h-4 text-xs tabular-nums"
				>
					{detail}
				</span>
			</span>
		</div>
	)
}
