import { useEffect, useState, type RefObject } from 'react'

/**
 * Whether the page has scrolled past a marker at its top, so content now runs
 * under the fixed nav.
 *
 * Watched by an `IntersectionObserver` rather than a scroll listener: it
 * answers once when the answer changes, instead of on every frame of a
 * scroll. False on the server, which renders the top of the page.
 */
export function useScrolledPast(marker: RefObject<HTMLElement | null>) {
	const [scrolled, setScrolled] = useState(false)

	useEffect(() => {
		const el = marker.current
		if (!el) return
		const observer = new IntersectionObserver(([entry]) =>
			setScrolled(!entry.isIntersecting)
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [marker])

	return scrolled
}
