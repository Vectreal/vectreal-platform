import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { CameraDrawing, CameraObject } from './camera-drawing'
import styles from './pilot-offer.module.css'
import { ProductPageSketch, SketchLine } from './product-page-sketch'
import {
	HOME_PAGE_COPY,
	PILOT_CONTACT_HREF
} from '../../constants/product-copy'

import type { ReactNode } from 'react'

const COPY = HOME_PAGE_COPY.pilot

/*
  One drawing per term, in the order a pilot runs: the files you bring, the
  viewer we build into your site, and the case study we publish together. Each
  is the hero's camera again, standing in for your product, so the three read
  as one project rather than three icons.
*/
const DRAWINGS: ReactNode[] = [
	<div
		key="files"
		className="text-muted-foreground flex h-full items-center justify-center"
	>
		<CameraDrawing className="w-3/5" />
	</div>,
	<ProductPageSketch
		key="site"
		compact
		// The frame around it sets the shape; its own 16:10 would fight the frame's padding.
		className="aspect-auto h-full"
		gallery={<CameraObject className="w-4/5" />}
	/>,
	<div
		key="case-study"
		className="bg-background flex h-full flex-col gap-2 p-2"
	>
		<div className="ds-sunken flex min-h-0 flex-1 items-center justify-center rounded-lg">
			<CameraObject className="w-1/2" />
		</div>
		<span className="text-eyebrow text-muted-foreground pt-1">
			{COPY.caseStudyLabel}
		</span>
		<SketchLine className="bg-foreground/20 h-3 w-4/5" />
		<SketchLine className="h-2 w-3/5" />
	</div>
]

/*
  How far below the pinned frame a term has to be to count as the one being
  read. Snap rests a term's top 48px below the frame (`pilot-offer.module.css`),
  so the line sits inside a resting term.
*/
const READING_LINE_BELOW_FRAME_PX = 64

/**
 * Keeps the pinned frame on the term being read, and the terms out of sight
 * behind it.
 *
 * Above the terms, on an upright phone, the term being read is the last one
 * whose top has passed a line just below the frame, where a term comes to
 * rest. Beside them it is how far the frame has travelled: it pins level with
 * the first term's top and lets go level with the last term's bottom, and the
 * stages split that travel in thirds. Anything read off the terms' heights got
 * one end wrong for some wrap of the copy: a line at the frame's middle never
 * met a short last term, a line at its bottom edge caught the second term from
 * the start, and the term nearest the frame's middle lost to a longer second
 * one. Both are read off the frame as it is.
 *
 * Above the terms, a term is also clipped at the frame's bottom edge as it
 * scrolls up under it. Otherwise its text showed wherever the frame did not
 * cover: in any gap left under the nav, and at the frame's rounded corners.
 * Pinning flush to the nav closed the gap and read as stuck to it, and filling
 * the gap with page cut a box out of the section's grain.
 *
 * Measured on every scroll frame rather than when an observer reports a
 * crossing: a jump that lands with no term on the line reports nothing, and
 * the stage stayed on whatever it showed before the jump.
 */
function usePinnedStage(count: number) {
	const frame = useRef<HTMLDivElement>(null)
	const terms = useRef<(HTMLElement | null)[]>([])
	const [active, setActive] = useState(0)

	useEffect(() => {
		const node = frame.current
		if (!node) return
		const placed = terms.current
			.slice(0, count)
			.filter((term): term is HTMLElement => term !== null)
		let pending = 0

		const update = () => {
			pending = 0
			const box = node.getBoundingClientRect()
			const rects = placed.map((term) => term.getBoundingClientRect())
			// From `lg` the frame is hidden, overlaps nothing, and clips nothing.
			const above = rects.some(
				(rect) => rect.left < box.right && box.left < rect.right
			)

			let current = 0
			if (above) {
				const line = box.bottom + READING_LINE_BELOW_FRAME_PX
				rects.forEach((rect, i) => {
					if (rect.top <= line) current = i
				})
			} else {
				const start = rects[0].top
				const travel = Math.max(
					1,
					rects[rects.length - 1].bottom - start - box.height
				)
				const progress = (box.top - start) / travel
				current = Math.min(
					rects.length - 1,
					Math.max(0, Math.floor(progress * rects.length))
				)
			}
			setActive(current)

			placed.forEach((term, i) => {
				const hidden = above ? box.bottom - rects[i].top : 0
				term.style.clipPath = hidden > 0 ? `inset(${hidden}px 0 0 0)` : ''
			})
		}
		const schedule = () => {
			if (!pending) pending = requestAnimationFrame(update)
		}

		update()
		window.addEventListener('scroll', schedule, { passive: true })
		window.addEventListener('resize', schedule)
		return () => {
			window.removeEventListener('scroll', schedule)
			window.removeEventListener('resize', schedule)
			cancelAnimationFrame(pending)
			for (const term of placed) term.style.clipPath = ''
		}
	}, [count])

	return { active, frame, terms }
}

/**
 * The founding-client offer, written as terms rather than as features.
 *
 * Each term has a small drawing of the stage of the project it belongs to, so
 * the offer can be read at a glance before it is read in full.
 *
 * On a wide screen the three sit side by side, and the same camera advancing
 * from sketch to page to case study reads as one project. Stacked on a phone
 * that comparison is gone: one drawing a screen, two of them the same render.
 * So below `lg` there is one frame, pinned while the terms scroll past it,
 * showing the stage of the term being read: above them on a phone held
 * upright, beside them from `sm`. That includes a phone held sideways, where a
 * frame above the terms would be taller than the screen, and a tablet, where
 * it would be half of it.
 *
 * Upright the column is flex, not grid, because a sticky grid item cannot
 * leave its own row; from `sm` the frame spans all three rows, which gives it
 * the room.
 */
export const PilotOffer = () => {
	const { active, frame, terms } = usePinnedStage(COPY.blocks.length)

	const last = COPY.blocks.length - 1
	const renderTerm = (block: (typeof COPY.blocks)[number], i: number) => (
		<div
			key={block.title}
			ref={(node) => {
				terms.current[i] = node
			}}
			className={cn(styles.term, 'flex flex-col gap-4')}
		>
			<div
				aria-hidden="true"
				className="ds-raised hidden aspect-16/10 overflow-hidden rounded-xl p-1.5 lg:block"
			>
				<div className="h-full overflow-hidden rounded-lg">{DRAWINGS[i]}</div>
			</div>
			<h3 className="text-h4 lg:pt-4">{block.title}</h3>
			<p className="text-muted-foreground text-body">{block.body}</p>
		</div>
	)

	return (
		<div className="flex flex-col gap-16">
			<div className="max-w-2xl">
				<h2 id="pilot-heading" className="text-headline" data-reveal>
					{COPY.heading}
				</h2>
				<p className="text-muted-foreground text-body-lg mt-8" data-reveal>
					{COPY.lead}
				</p>
			</div>

			<div
				className="flex flex-col gap-12 sm:grid sm:grid-cols-2 sm:gap-x-12 lg:grid-cols-3 lg:gap-8"
				data-reveal
			>
				{/*
				  The frame and every term but the last share a box, and the last
				  term sits after it. A sticky element lets go where its box ends,
				  so the frame lets go as the second term leaves, with the last one
				  whole beneath it and already read, and the two scroll on together.
				  Around all of them, it let go only once the last term had scrolled
				  under it, and that term left the section half covered. From `sm`
				  the box is `contents`, so the grid places what is inside it.
				*/}
				<div className="flex flex-col gap-12 sm:contents">
					{/*
					  16px under the 52px mobile nav. From `sm` it stands at 80px,
					  clear of both navs: the mobile one runs to `md`, and the 56px
					  desktop one takes over there.
					*/}
					<div
						ref={frame}
						aria-hidden="true"
						data-stage={active}
						className="sticky top-17 z-10 sm:top-20 sm:row-span-3 sm:self-start lg:hidden"
					>
						<div className="ds-raised aspect-16/10 overflow-hidden rounded-xl p-1.5">
							<div className="relative h-full overflow-hidden rounded-lg">
								{DRAWINGS.map((drawing, i) => (
									<div
										key={i}
										className={cn(
											'absolute inset-0 transition-[opacity,scale] duration-(--duration-slow) ease-(--ease-out) motion-reduce:transition-none',
											i === active ? 'opacity-100' : 'scale-[0.97] opacity-0'
										)}
									>
										{drawing}
									</div>
								))}
							</div>
						</div>
					</div>

					{COPY.blocks.slice(0, -1).map(renderTerm)}
				</div>
				{renderTerm(COPY.blocks[last], last)}
			</div>

			<div
				className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"
				data-reveal
			>
				<p className="text-foreground text-body max-w-md">{COPY.team}</p>
				<Button asChild size="lg" className="w-full sm:w-fit">
					<Link to={PILOT_CONTACT_HREF}>
						{COPY.cta}
						<ArrowRight aria-hidden="true" />
					</Link>
				</Button>
			</div>
		</div>
	)
}
