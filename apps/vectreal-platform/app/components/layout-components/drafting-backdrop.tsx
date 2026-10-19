import { cn } from '@shared/utils'
import { useEffect, useRef } from 'react'

import { prefersReducedMotion } from '../../lib/motion/motion-tokens'

import type { DraftingBackdropOptions } from './drafting-backdrop-engine'

/** Below this width the lines meet in the middle, under the copy. */
const PHONE_PX = 760
const EDGE_FADE =
	'[mask-image:linear-gradient(to_bottom,transparent,black_96px,black_calc(100%-96px),transparent)]'

interface DraftingBackdropProps {
	/** Where the lines meet on a wider canvas, as a fraction of its width: away from the copy. */
	focusX: number
	/** Where the horizon sits on a wider canvas, as a fraction of its height. */
	horizon?: number
	/** Where it sits on a phone: low by default, so a page head's copy stands in the sky above it. */
	phoneHorizon?: number
	/** See `DraftingBackdropOptions.travel`. `page` keeps the floor under the reader for the whole of its host. */
	travel?: DraftingBackdropOptions['travel']
	/** Positions the box. Defaults to filling its nearest positioned ancestor, behind it. */
	className?: string
}

/**
 * The drafting floor behind a section: the site's backdrop.
 *
 * The element it sits in is the floor's host: pointing anywhere in it leans on
 * the floor, its headings and paragraphs (and anything marked
 * `data-keep-clear`) thin the lines behind them, and an object marked `data-floor-light` stands in a light on it. The
 * parent must be a stacking context (`isolate`), so the floor sits behind its
 * content and above its surface.
 *
 * Only the canvas is in the server's HTML. The engine is imported once the
 * page is running, so no route's first load carries it, and the canvas fades
 * in on its first frame rather than landing all at once.
 */
export function DraftingBackdrop({
	focusX,
	horizon = 0.5,
	phoneHorizon = 0.68,
	travel = 'box',
	className
}: DraftingBackdropProps) {
	const boxRef = useRef<HTMLDivElement>(null)
	const ref = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = ref.current
		const host = boxRef.current?.parentElement
		if (!canvas || !host) return
		let dispose: (() => void) | undefined
		let cancelled = false
		import('./drafting-backdrop-engine')
			.then(({ createDraftingBackdrop }) => {
				if (cancelled) return
				dispose = createDraftingBackdrop(canvas, {
					reducedMotion: prefersReducedMotion(),
					host,
					travel,
					view: (box) =>
						box.width < PHONE_PX
							? { horizon: phoneHorizon, focusX: 0.5 }
							: { horizon, focusX }
				})?.dispose
			})
			// A chunk that will not load (a deploy replaced it) leaves the page without its floor, which it can do without.
			.catch(() => {})
		return () => {
			cancelled = true
			dispose?.()
		}
	}, [focusX, horizon, phoneHorizon, travel])

	/*
	  A canvas keeps its intrinsic height under top and bottom, so a box sizes it
	  and it fills the box. The floor fades out toward its top and bottom edges,
	  so it never ends on a straight cut.

	  A page floor is one screen tall and sticks to the viewport inside the box,
	  which spans its host: it stays under the reader while they scroll, and
	  leaves with the host's last screen instead of covering what follows it.
	*/
	const canvasElement = (
		<canvas
			ref={ref}
			className="block size-full opacity-0 transition-opacity duration-(--duration-cinematic) ease-(--ease-out) data-painted:opacity-100 motion-reduce:transition-none"
		/>
	)
	return (
		<div
			ref={boxRef}
			aria-hidden="true"
			className={cn(
				'pointer-events-none absolute inset-0 -z-1',
				travel === 'box' && EDGE_FADE,
				className
			)}
		>
			{travel === 'page' ? (
				<div className={cn('sticky top-0 h-dvh', EDGE_FADE)}>
					{canvasElement}
				</div>
			) : (
				canvasElement
			)}
		</div>
	)
}
