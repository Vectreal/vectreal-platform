import { useEffect, useRef, type ReactNode } from 'react'

import {
	duration,
	ease,
	prefersReducedMotion
} from '../../lib/motion/motion-tokens'

/** How far a block rises to its place: enough to read as arriving, not enough to read as moving. */
const RISE_PX = 12
/** Blocks arrive one after another, in document order. */
const STAGGER_MS = 90
const EASING = `cubic-bezier(${ease.out.join(', ')})`

const hide = (el: HTMLElement) => {
	el.style.opacity = '0'
	el.style.transform = `translateY(${RISE_PX}px)`
}
const show = (el: HTMLElement) => {
	el.style.opacity = ''
	el.style.transform = ''
}

/**
 * Brings a section's blocks in the first time it scrolls into view.
 *
 * Each element marked `data-reveal` fades up a short way into its place, one
 * after another. Opacity and transform only, on the compositor, so it looks
 * the same at any frame rate; the dither dissolve it replaced swapped a mask
 * image every frame and flashed when a frame beat the mask's decode.
 *
 * `motion.md` calls arrival motion on scroll decoration. The user asked for it
 * on the home page knowingly: a decision for this page, not a precedent.
 *
 * Once, and only below the fold. A section already on screen when the page
 * hydrates is never hidden, so server-rendered content cannot flash out and
 * back; without script, or under reduced motion, nothing is hidden at all.
 * Printing shows every block first, since a printed page never scrolls.
 */
export function Reveal({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const root = ref.current
		if (!root) return
		if (prefersReducedMotion()) return
		if (root.getBoundingClientRect().top < window.innerHeight) return

		const blocks = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
		for (const el of blocks) hide(el)

		const animations: Animation[] = []
		/** Every block in its place now, whatever it was doing, and never hidden again. */
		const showAtOnce = () => {
			observer.disconnect()
			for (const animation of animations) animation.cancel()
			for (const el of blocks) show(el)
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return
				observer.disconnect()

				// Jumped past, by an anchor or a fling, or motion was turned off
				// since the page loaded: show it at once.
				if (entry.boundingClientRect.bottom < 0 || prefersReducedMotion()) {
					showAtOnce()
					return
				}

				for (const [i, el] of blocks.entries()) {
					const animation = el.animate(
						[
							{ opacity: 0, transform: `translateY(${RISE_PX}px)` },
							{ opacity: 1, transform: 'translateY(0)' }
						],
						{
							duration: duration.cinematic * 1000,
							delay: i * STAGGER_MS,
							easing: EASING,
							fill: 'both'
						}
					)
					animations.push(animation)
					// The animation holds the hidden state through its delay; the inline one has to go, or the block stays hidden once it ends.
					show(el)
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
		// A printed page is never scrolled, so a section not reached yet would print blank.
		window.addEventListener('beforeprint', showAtOnce)

		return () => {
			window.removeEventListener('beforeprint', showAtOnce)
			showAtOnce()
		}
	}, [])

	return <div ref={ref}>{children}</div>
}
