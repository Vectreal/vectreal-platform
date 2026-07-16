import { Button } from '@shared/components/ui/button'
import { motion, useTransform, type MotionValue } from 'framer-motion'

import {
	CHAPTERS,
	chapterFadeRange,
	STACK_END,
	type Chapter
} from './mock-shop-chapters'

// One chapter's text content: eyebrow, heading, description, and either the shop
// CTA or the SDK code snippet.
function ChapterContent({ chapter }: { chapter: Chapter }) {
	return (
		<>
			<p className="text-accent/80 text-[10px] font-semibold tracking-[0.22em] uppercase">
				{chapter.label}
			</p>

			{/* Heading — each \n becomes a block span for line-break control */}
			<h4 className="text-foreground text-[1.75rem] leading-[1.1] tracking-tight md:text-3xl lg:text-[2.125rem]">
				{chapter.heading.split('\n').map((line, i) => (
					<span key={i} className="block">
						{line}
					</span>
				))}
			</h4>

			<p className="text-foreground/50 text-sm leading-relaxed md:text-[0.9375rem]">
				{chapter.description}
			</p>

			{chapter.type === 'shop' ? (
				<div className="mt-1 flex flex-col gap-3">
					<div>
						<p className="text-foreground/25 text-[10px] tracking-[0.18em] uppercase">
							Coupe · 4.0L Flat-6 · 510 HP · Jet Black Metallic
						</p>
						<p className="text-accent mt-1 text-2xl font-bold tracking-tight">
							$182,900
						</p>
					</div>
					<Button
						disabled
						className="border-foreground/10 bg-foreground/5 text-foreground/40 w-full"
						variant="outline"
						size="sm"
					>
						Configure
					</Button>
					<p className="text-foreground/20 text-[11px]">
						Concept demo · Not for sale
					</p>
				</div>
			) : (
				<div className="border-foreground/[0.07] bg-foreground/3 mt-1 rounded-xl border px-4 py-3">
					<code className="text-foreground/55 font-mono text-[11px] break-all md:text-xs">
						{chapter.code}
					</code>
				</div>
			)}
		</>
	)
}

// One panel in the scroll-tracked filmstrip. Only opacity is animated, via an
// array-form scroll transform with [0,1] offsets, so framer-motion runs it as a
// compositor animation (no per-frame JS) — matching the smoothness of the 3D
// canvas. overflow-hidden clips each panel to its slot so chapters can't overlap.
function FilmstripPanel({
	index,
	progress,
	reduced,
	children
}: {
	index: number
	progress: MotionValue<number>
	reduced: boolean
	children: React.ReactNode
}) {
	const { input, output } = chapterFadeRange(index, reduced ? 0.25 : 0.12)
	const opacity = useTransform(progress, input, output)
	return (
		<motion.div
			style={{ opacity, willChange: 'opacity' }}
			className="flex h-[25%] flex-col justify-center gap-3 overflow-hidden"
		>
			{children}
		</motion.div>
	)
}

// The reading band: a fixed-height window with a stack of chapter panels that
// glides vertically as scroll progresses, so scroll position drives which
// chapter is centered. Sized to the tallest chapter to avoid clipping content.
export function Filmstrip({
	progress,
	reduced
}: {
	progress: MotionValue<number>
	reduced: boolean
}) {
	const stackY = useTransform(progress, [0, 1], ['0%', STACK_END])
	return (
		<div className="relative h-[300px] overflow-hidden md:h-[340px]">
			<motion.div
				style={{ y: stackY, willChange: 'transform' }}
				className="flex h-[400%] flex-col"
			>
				{CHAPTERS.map((c, i) => (
					<FilmstripPanel
						key={c.id}
						index={i}
						progress={progress}
						reduced={reduced}
					>
						<ChapterContent chapter={c} />
					</FilmstripPanel>
				))}
			</motion.div>
		</div>
	)
}
