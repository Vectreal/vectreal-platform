import { cn } from '@shared/utils'
import { useEffect, useRef } from 'react'

import { prefersReducedMotion } from '../../lib/motion/motion-tokens'

import type { DraftingView } from './drafting-backdrop-engine'

/** A phone's narrow canvas puts the horizon low and the lines' meeting point in the middle, under the copy. */
const PHONE_PX = 760
const PHONE_VIEW: DraftingView = { horizon: 0.68, focusX: 0.5 }

interface DraftingBackdropProps {
	/** Where the lines meet on a wider canvas, as a fraction of its width: away from the copy. */
	focusX: number
	/** Where the horizon sits on a wider canvas, as a fraction of its height. */
	horizon?: number
	/** Positions the box. Defaults to filling its nearest positioned ancestor, behind it. */
	className?: string
}

/**
 * The drafting floor behind a section: the site's backdrop.
 *
 * The section it sits in is the floor's host: pointing anywhere in it leans on
 * the floor, and text marked `data-keep-clear` inside it thins the lines
 * behind it. The parent must be a stacking context (`isolate`), so the floor
 * sits behind its content and above its surface.
 *
 * Only the canvas is in the server's HTML. The engine is imported once the
 * page is running, so no route's first load carries it, and the canvas fades
 * in on its first frame rather than landing all at once.
 */
export function DraftingBackdrop({
	focusX,
	horizon = 0.5,
	className
}: DraftingBackdropProps) {
	const ref = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = ref.current
		const host = canvas?.parentElement?.parentElement
		if (!canvas || !host) return
		let dispose: (() => void) | undefined
		let cancelled = false
		import('./drafting-backdrop-engine').then(({ createDraftingBackdrop }) => {
			if (cancelled) return
			dispose = createDraftingBackdrop(canvas, {
				reducedMotion: prefersReducedMotion(),
				host,
				view: (box) => (box.width < PHONE_PX ? PHONE_VIEW : { horizon, focusX })
			})?.dispose
		})
		return () => {
			cancelled = true
			dispose?.()
		}
	}, [focusX, horizon])

	/*
	  A canvas keeps its intrinsic height under top and bottom, so a box sizes it
	  and it fills the box. The floor fades out toward the box's top and bottom
	  edges, so it never ends on a straight cut where its section does.
	*/
	return (
		<div
			aria-hidden="true"
			className={cn(
				'pointer-events-none absolute inset-0 -z-1 [mask-image:linear-gradient(to_bottom,transparent,black_96px,black_calc(100%-96px),transparent)]',
				className
			)}
		>
			<canvas
				ref={ref}
				className="block size-full opacity-0 transition-opacity duration-(--duration-cinematic) ease-(--ease-out) data-painted:opacity-100 motion-reduce:transition-none"
			/>
		</div>
	)
}
