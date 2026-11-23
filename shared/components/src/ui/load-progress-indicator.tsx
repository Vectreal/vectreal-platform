import { cn } from '@shared/utils'
import { useEffect, useState } from 'react'

import {
	describeLoadProgress,
	LOAD_PROGRESS_DELAY_MS,
	LOAD_PROGRESS_WORDS,
	useDelayedVisible
} from './load-progress'
import { ProgressRing } from './progress-ring'

import type { LoadProgressValue, LoadProgressWords } from './load-progress'
import type { FC } from 'react'

interface LoadProgressIndicatorProps {
	/** Absent while nothing is known yet: the ring turns and the title says only "Loading". */
	progress?: LoadProgressValue | null
	/** What is loading, for the download's title: "Downloading Rocket". */
	subject?: string
	words?: LoadProgressWords
	/** Milliseconds before it shows. */
	delayMs?: number
	className?: string
}

/**
 * The app's drawing of a model on its way: the Publisher's stage and the
 * converter. The published viewer draws the same `describeLoadProgress` with
 * its own `vv:` classes, which is why the reading and the markup are apart.
 *
 * A ring and two lines, as the save panel draws its progress. The ring
 * measures only a download with a known size; parsing and preparing turn it
 * indeterminate rather than invent a percentage. The numbers reach a screen
 * reader as the progress bar's value text; only the title is announced, and
 * only when the phase changes.
 *
 * No box around it: it sits on whatever the caller draws behind it.
 */
export const LoadProgressIndicator: FC<LoadProgressIndicatorProps> = ({
	progress,
	subject,
	words = LOAD_PROGRESS_WORDS,
	delayMs = LOAD_PROGRESS_DELAY_MS,
	className
}) => {
	const visible = useDelayedVisible(delayMs)
	// One commit after mount at the earliest, so the region exists before its
	// first title even with no delay.
	const [regionMounted, setRegionMounted] = useState(false)
	useEffect(() => setRegionMounted(true), [])
	const { title, detail, percent } = describeLoadProgress(
		progress,
		words,
		subject
	)

	return (
		<>
			{/*
			  Outside the delayed root and mounted from the start, so a screen
			  reader already knows the region when its first title arrives; a
			  region that appears and fills in one commit is often not read.
			*/}
			<span aria-live="polite" className="sr-only">
				{visible && regionMounted ? title : ''}
			</span>
			<div
				className={cn(
					'flex flex-col items-center justify-center gap-3 text-center',
					!visible && 'invisible',
					className
				)}
			>
				<span
					role="progressbar"
					aria-label={title}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent ?? undefined}
					aria-valuetext={detail ?? undefined}
				>
					<ProgressRing value={percent} className="text-orange size-7" />
				</span>
				{/* Drawn for the eye; the progress bar above carries both lines for a screen reader. */}
				<span aria-hidden className="grid gap-0.5">
					<span className="text-sm font-medium">{title}</span>
					<span className="text-muted-foreground min-h-4 text-xs tabular-nums">
						{detail}
					</span>
				</span>
			</div>
		</>
	)
}
