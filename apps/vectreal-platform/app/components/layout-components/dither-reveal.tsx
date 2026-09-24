import { useEffect, useRef, type ReactNode } from 'react'

import { DITHER_CELL_PX, DITHER_DISSOLVE_FRAMES } from '../../lib/dither/dither'

/** How far a block travels to its seat. */
const TRAVEL_PX = 20
/** How far it runs past the seat before it settles back: the detent. */
const OVERSHOOT_PX = 2
/** One block's whole arrival; the overshoot lands at `SEAT_AT` of it. */
const DURATION_MS = 520
const SEAT_AT = 0.68
/** Blocks arrive one after another, in document order. */
const STAGGER_MS = 70

// `--ease-out`, for the approach; the settle back is a short ease-in-out.
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)'

const MASK_SIZE = `${4 * DITHER_CELL_PX}px ${4 * DITHER_CELL_PX}px`

function setFrame(el: HTMLElement, k: number) {
	for (const prefix of ['', '-webkit-']) {
		el.style.setProperty(`${prefix}mask-image`, DITHER_DISSOLVE_FRAMES[k])
		el.style.setProperty(`${prefix}mask-size`, MASK_SIZE)
	}
}

function clearFrame(el: HTMLElement) {
	for (const prefix of ['', '-webkit-']) {
		el.style.removeProperty(`${prefix}mask-image`)
		el.style.removeProperty(`${prefix}mask-size`)
	}
}

/**
 * Seats a section's blocks the first time it scrolls into view.
 *
 * Each element marked `data-reveal` travels a short way up, runs a couple of
 * pixels past its place and settles back: a detent, so it reads as clicking
 * into position rather than drifting in. While it travels it resolves from the
 * page's grain, the hero's 4 by 4 matrix, and turns solid exactly as it seats,
 * so the grain is the click and not a curtain drawn across it. The whole
 * section lands in about half a second.
 *
 * `motion.md` calls arrival motion on scroll decoration. The user asked for it
 * on the home page knowingly, as they accepted the hero's drift: a decision for
 * this page, not a precedent.
 *
 * Once, and only below the fold. A section already on screen when the page
 * hydrates is never hidden, so server-rendered content cannot flash out and
 * back; without script, or under reduced motion, nothing is hidden at all.
 */
export function DitherReveal({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const root = ref.current
		if (!root) return
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		if (root.getBoundingClientRect().top < window.innerHeight) return

		const blocks = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
		for (const el of blocks) {
			setFrame(el, 0)
			el.style.transform = `translateY(${TRAVEL_PX}px)`
		}

		const frames: number[] = []
		const animations: Animation[] = []
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return
				observer.disconnect()

				// Jumped past, by an anchor or a fling, or motion was turned off
				// since the page loaded: seat it at once.
				if (
					entry.boundingClientRect.bottom < 0 ||
					window.matchMedia('(prefers-reduced-motion: reduce)').matches
				) {
					for (const el of blocks) {
						clearFrame(el)
						el.style.transform = ''
					}
					return
				}

				for (const [i, el] of blocks.entries()) {
					const delay = i * STAGGER_MS
					const animation = el.animate(
						[
							{
								transform: `translateY(${TRAVEL_PX}px)`,
								easing: EASE_OUT
							},
							{
								transform: `translateY(${-OVERSHOOT_PX}px)`,
								offset: SEAT_AT,
								easing: EASE_IN_OUT
							},
							{ transform: 'translateY(0)' }
						],
						{ duration: DURATION_MS, delay, fill: 'both' }
					)
					animations.push(animation)
					el.style.transform = ''

					// The grain resolves over the approach and is solid at the seat.
					const seatMs = DURATION_MS * SEAT_AT
					const t0 = performance.now() + delay
					const step = (t: number) => {
						const k = Math.max(
							0,
							Math.min(Math.floor(((t - t0) / seatMs) * 16), 16)
						)
						if (k < 16) {
							setFrame(el, k)
							frames[i] = requestAnimationFrame(step)
						} else clearFrame(el)
					}
					frames[i] = requestAnimationFrame(step)

					animation.finished.then(() => animation.cancel()).catch(() => {})
				}
			},
			/*
			  A little into the viewport at the bottom, so the arrival is seen
			  rather than finished below the edge. Unbounded at the top: a
			  section scrolled past in one jump never crosses the viewport, so
			  with a plain root it stayed hidden for good.
			*/
			{ rootMargin: '100000px 0px -12% 0px' }
		)
		observer.observe(root)

		return () => {
			observer.disconnect()
			for (const frame of frames) cancelAnimationFrame(frame)
			for (const animation of animations) animation.cancel()
			for (const el of blocks) {
				clearFrame(el)
				el.style.transform = ''
			}
		}
	}, [])

	return <div ref={ref}>{children}</div>
}
