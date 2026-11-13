import {
	describeLoadProgress,
	LOAD_PROGRESS_DELAY_MS,
	useDelayedVisible
} from '@shared/components/ui/load-progress'
import { createContext, useContext, useState } from 'react'

import { cn } from './class-names'
import { useViewerMessages } from './viewer-messages'
import { formatMessage } from '../locales/en'

import type { LoadProgressWords } from '@shared/components/ui/load-progress'
import type { LoadProgress } from '@vctrl/core'
import type { FC, ReactNode } from 'react'

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * When the viewer's current load began. The loader is mounted twice in one
 * load, as the canvas's Suspense fallback and then in the overlay, so its
 * delay counts from here rather than from its own mount, or the second mount
 * would hide it again for another delay.
 */
export const ViewerLoadClockContext = createContext<number | null>(null)

/**
 * A function `loader`, drawn as an element: the overlay keeps its fade
 * container whatever the function returns, `null` included, so the fade
 * still ends and the viewer's chrome still appears.
 */
export const ProgressLoader: FC<{
	render: (progress: LoadProgress | null) => ReactNode
	progress: LoadProgress | null
}> = ({ render, progress }) => <>{render(progress)}</>

/**
 * The viewer's default loader: the same reading of a load as the app's
 * `LoadProgressIndicator` (`describeLoadProgress`), drawn with the viewer's
 * own `vv:` classes, which are the only ones the published bundle carries.
 *
 * The overlay around it is already the loading status region, so this adds
 * no live region of its own: the progress bar's name is the phase and its
 * value text the numbers.
 */
export const ViewerLoadProgress: FC<{ progress: LoadProgress | null }> = ({
	progress
}) => {
	const messages = useViewerMessages()
	const startedAt = useContext(ViewerLoadClockContext)
	const [delayMs] = useState(() =>
		startedAt === null
			? LOAD_PROGRESS_DELAY_MS
			: startedAt + LOAD_PROGRESS_DELAY_MS - Date.now()
	)
	const visible = useDelayedVisible(delayMs)
	const words: LoadProgressWords = {
		loading: messages.loading,
		fetching: () => messages.loadDownloading,
		parsing: messages.loadReading,
		preparing: messages.loadPreparing,
		bytes: (loaded, total) =>
			total ? formatMessage(messages.loadBytes, { loaded, total }) : loaded,
		items: (loaded, total) =>
			formatMessage(messages.loadFiles, {
				loaded: String(loaded),
				total: String(total)
			})
	}
	const { title, detail, percent } = describeLoadProgress(progress, words)

	return (
		<div
			className={cn(
				'vv:flex vv:flex-col vv:items-center vv:gap-3 vv:text-center',
				!visible && 'vv:invisible'
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
				{}
				<svg
					viewBox="0 0 24 24"
					aria-hidden
					className={cn(
						'vv:block vv:size-7 vv:-rotate-90 vv:text-[var(--orange,#fc6c18)]',
						percent === null && 'vv:motion-safe:animate-spin'
					)}
				>
					<circle
						cx="12"
						cy="12"
						r={RADIUS}
						fill="none"
						strokeWidth="2.5"
						stroke="currentColor"
						opacity={0.2}
					/>
					<circle
						cx="12"
						cy="12"
						r={RADIUS}
						fill="none"
						strokeWidth="2.5"
						strokeLinecap="round"
						stroke="currentColor"
						strokeDasharray={percent === null ? '4 3' : CIRCUMFERENCE}
						strokeDashoffset={
							percent === null ? 0 : CIRCUMFERENCE * (1 - percent / 100)
						}
						className="vv:transition-[stroke-dashoffset] vv:duration-250 vv:ease-[cubic-bezier(0.16,1,0.3,1)] vv:motion-reduce:transition-none"
					/>
				</svg>
			</span>
			<span aria-hidden className="vv:grid vv:gap-0.5">
				<span className="vv:text-sm vv:font-medium vv:text-foreground">
					{title}
				</span>
				<span className="vv:text-muted-foreground vv:min-h-4 vv:text-xs vv:tabular-nums">
					{detail}
				</span>
			</span>
		</div>
	)
}
