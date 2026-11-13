import { type RefObject, useEffect, useRef, useState } from 'react'

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
				rootMargin: '50% 0px',
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

/**
 * Whether at least half of the element is on screen, against the top-level
 * viewport even from inside a cross-origin frame. True until measured.
 */
export function useMostlyVisible(
	elementRef: RefObject<HTMLElement | null>,
	enabled: boolean
): boolean {
	const [isMostlyVisible, setIsMostlyVisible] = useState(true)

	useEffect(() => {
		const element = elementRef.current
		if (!enabled || !element || typeof IntersectionObserver === 'undefined') {
			return
		}
		const observer = new IntersectionObserver(
			([entry]) => setIsMostlyVisible(entry.intersectionRatio >= 0.5),
			{ threshold: [0.5] }
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [elementRef, enabled])

	return isMostlyVisible
}
