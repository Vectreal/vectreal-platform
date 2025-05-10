import { useEffect, useRef, useState } from 'react'

/**
 * A custom hook that tracks whether a scrollable element is at the top.
 *
 * @param {number} margin - The margin in pixels to consider when determining if the element is at the top.
 */
const useIsAtTop = (margin = 48) => {
	const intersectionObsetver = useRef<IntersectionObserver | null>(null)
	const [isAtTop, setIsAtTop] = useState(true)
	const ref = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const currentRef = ref.current
		if (!currentRef) return

		intersectionObsetver.current = new IntersectionObserver(
			(entries) =>
				entries.forEach((entry) =>
					entry.isIntersecting ? setIsAtTop(true) : setIsAtTop(false)
				),
			{
				root: null,
				rootMargin: `${margin}px 0px -${margin}px 0px`
			}
		)

		intersectionObsetver.current.observe(currentRef)

		return () => {
			if (intersectionObsetver.current && currentRef) {
				intersectionObsetver.current.unobserve(currentRef)
			}
			intersectionObsetver.current?.disconnect()
			intersectionObsetver.current = null
		}
	}, [ref, margin])

	return { isAtTop, ref }
}

export { useIsAtTop }
