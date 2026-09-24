import { useEffect, useRef, type ReactNode } from 'react'

import { ditherFadeDownMask } from '../../lib/dither/dither'

/** Height of the dithered edge that leads a wipe. */
const EDGE_PX = 160
/** A wipe's pace, so a tall heading takes longer than a short one, within a range that reads as a wipe and never drags. */
const PX_PER_MS = 0.25
const MIN_MS = 1600
const MAX_MS = 2400
/** Everything else fades, starting once the headings are under way, one after another. */
const FADE_MS = 1400
const FADE_DELAY_MS = 350
const FADE_STAGGER_MS = 140

const EDGE = ditherFadeDownMask(EDGE_PX)
const MASK_KEYS = ['image', 'size', 'repeat', 'position'] as const

function setMask(el: HTMLElement, top: number) {
	const mask = {
		image: `linear-gradient(#000, #000), ${EDGE}`,
		size: `100% ${Math.max(0, top)}px, 8px ${EDGE_PX}px`,
		repeat: 'no-repeat, repeat-x',
		position: `0 0, 0 ${top}px`
	}
	for (const prefix of ['', '-webkit-']) {
		for (const key of MASK_KEYS)
			el.style.setProperty(`${prefix}mask-${key}`, mask[key])
	}
}

function clearMask(el: HTMLElement) {
	for (const prefix of ['', '-webkit-']) {
		for (const key of MASK_KEYS) el.style.removeProperty(`${prefix}mask-${key}`)
	}
}

const inOut = (k: number) =>
	k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2

/**
 * Reveals a section the first time it scrolls into view.
 *
 * Its elements say how, with `data-reveal`. The large type (`"wipe"`) is
 * uncovered by a dithered edge travelling down it, the same ramp the hero's
 * sheet dissolves into the page with, so the page arrives in its own material.
 * Everything else (`"fade"`: body text, the product and code windows) simply
 * fades in after it: a wipe across a big plane reads as a curtain, not a detail.
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

		const wipes = [
			...root.querySelectorAll<HTMLElement>('[data-reveal="wipe"]')
		]
		const fades = [
			...root.querySelectorAll<HTMLElement>('[data-reveal="fade"]')
		]
		for (const el of wipes) setMask(el, -EDGE_PX)
		for (const el of fades) el.style.opacity = '0'

		const frames: number[] = []
		const animations: Animation[] = []
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return
				observer.disconnect()

				for (const [i, el] of wipes.entries()) {
					const distance = el.offsetHeight + EDGE_PX * 2
					const duration = Math.min(
						Math.max(distance / PX_PER_MS, MIN_MS),
						MAX_MS
					)
					const t0 = performance.now()
					const step = (t: number) => {
						const k = Math.min((t - t0) / duration, 1)
						setMask(el, -EDGE_PX + distance * inOut(k))
						if (k < 1) frames[i] = requestAnimationFrame(step)
						else clearMask(el)
					}
					frames[i] = requestAnimationFrame(step)
				}

				for (const [i, el] of fades.entries()) {
					const animation = el.animate([{ opacity: 0 }, { opacity: 1 }], {
						duration: FADE_MS,
						delay: FADE_DELAY_MS + i * FADE_STAGGER_MS,
						easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
						fill: 'forwards'
					})
					animations.push(animation)
					animation.finished
						.then(() => {
							el.style.opacity = ''
							animation.cancel()
						})
						.catch(() => {})
				}
			},
			// A little into the viewport, so the reveal is seen rather than finished below the edge.
			{ rootMargin: '0px 0px -12% 0px' }
		)
		observer.observe(root)

		return () => {
			observer.disconnect()
			for (const frame of frames) cancelAnimationFrame(frame)
			for (const animation of animations) animation.cancel()
			for (const el of wipes) clearMask(el)
			for (const el of fades) el.style.opacity = ''
		}
	}, [])

	return <div ref={ref}>{children}</div>
}
