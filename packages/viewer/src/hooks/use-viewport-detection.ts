import { useEffect, useRef, useState } from 'react'

/**
 * Hook to detect if an element is visible in the viewport using Intersection Observer.
 *
 * @param enabled - Whether viewport detection is enabled
 * @param options - Intersection Observer options
 * @returns Tuple of [ref to attach to element, isInViewport boolean]
 */
export function useViewportDetection(
	enabled = true,
	options?: IntersectionObserverInit
) {
	const [isInViewport, setIsInViewport] = useState(!enabled)
	const elementRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!enabled || !elementRef.current) {
			return
		}

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					setIsInViewport(entry.isIntersecting)
				})
			},
			{
				root: null,
				rootMargin: '50px',
				threshold: 0,
				...options
			}
		)

		observer.observe(elementRef.current)

		return () => {
			observer.disconnect()
		}
	}, [enabled, options])

	return [elementRef, isInViewport] as const
}
