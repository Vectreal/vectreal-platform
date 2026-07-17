import { useEffect, useRef } from 'react'

/**
 * iOS Safari (WebKit) caches CSS scroll-snap point positions at layout time
 * and does not reliably recompute them when an ancestor's transform changes
 * afterward (e.g. a Framer Motion scroll-reveal animating a parent `y`/
 * `opacity`). That leaves the cached snap points stale, so swipes on the
 * row read as stuck or jittery. Forcing a `scroll-snap-type` toggle (which
 * triggers a synchronous reflow) makes WebKit rebuild the cache.
 * See bugs.webkit.org #173887, #203968 and framer/motion#342.
 */
export function useIOSSnapScrollFix<T extends HTMLElement>() {
	const ref = useRef<T>(null)

	useEffect(() => {
		const element = ref.current
		if (!element) return

		const resync = () => {
			element.style.scrollSnapType = 'none'
			void element.offsetHeight
			element.style.scrollSnapType = ''
		}

		const timers = [150, 800, 1500].map((delay) =>
			window.setTimeout(resync, delay)
		)
		window.addEventListener('resize', resync)
		window.addEventListener('orientationchange', resync)

		return () => {
			for (const timer of timers) window.clearTimeout(timer)
			window.removeEventListener('resize', resync)
			window.removeEventListener('orientationchange', resync)
		}
	}, [])

	return ref
}
