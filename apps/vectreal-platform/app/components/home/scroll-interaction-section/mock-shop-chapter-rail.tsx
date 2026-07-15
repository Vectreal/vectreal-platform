import { cn } from '@shared/utils'
import { motion, useTransform, type MotionValue } from 'framer-motion'

import {
	CHAPTERS,
	chapterFadeRange,
	INDICATOR_END,
	type ChapterId
} from './mock-shop-chapters'

// A single tab label whose brightness tracks how close scroll is to this tab, so
// emphasis glides continuously with the indicator and the filmstrip. Array-form
// scroll transform → compositor-driven, no per-frame JS.
function TabLabel({
	index,
	label,
	progress
}: {
	index: number
	label: string
	progress: MotionValue<number>
}) {
	const { input, output } = chapterFadeRange(index, 0.25)
	const opacity = useTransform(progress, input, output)
	return (
		<motion.span
			style={{ opacity, willChange: 'opacity' }}
			className="text-foreground text-[10px] font-medium tracking-[0.12em] uppercase"
		>
			{label}
		</motion.span>
	)
}

// Chapter tabs with one accent indicator that is BOTH the scroll-progress bar
// and the active-tab underline. Everything here reads the same scroll `progress`:
// equal-width columns (grid-cols-4), an indicator one column wide translated by
// its own width across the columns, and per-tab emphasis from the same value —
// so the indicator, the labels and the filmstrip can never drift apart.
export function ChapterRail({
	progress,
	activeChapter,
	onSelect,
	className
}: {
	progress: MotionValue<number>
	activeChapter: ChapterId
	onSelect: (id: ChapterId) => void
	className?: string
}) {
	const indicatorX = useTransform(progress, [0, 1], ['0%', INDICATOR_END])
	return (
		<div className={cn('relative grid grid-cols-4', className)}>
			{/* Full-width track */}
			<span className="bg-foreground/10 absolute right-0 bottom-0 left-0 h-px rounded-full" />
			{/* Unified progress + active underline */}
			<motion.span
				aria-hidden
				style={{ x: indicatorX, width: '25%', willChange: 'transform' }}
				className="bg-accent absolute bottom-0 left-0 h-px rounded-full"
			/>
			{CHAPTERS.map((c, i) => (
				<button
					key={c.id}
					onClick={() => onSelect(c.id)}
					className="pr-4 pb-2.5 text-center"
					aria-label={`View ${c.label}`}
					aria-current={activeChapter === c.id ? 'true' : undefined}
				>
					<TabLabel index={i} label={c.label} progress={progress} />
				</button>
			))}
		</div>
	)
}
