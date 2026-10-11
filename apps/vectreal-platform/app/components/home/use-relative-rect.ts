import { useLayoutEffect, useState, type RefObject } from 'react'

import type { FrameRect } from './product-stage'

/**
 * Where `child` sits inside `container`, as shares of the container's size,
 * measured before paint and again whenever the container resizes. Null until
 * the first measurement, and while the container has no size.
 */
export function useRelativeRect(
	containerRef: RefObject<HTMLElement | null>,
	childRef: RefObject<HTMLElement | null>
): FrameRect | null {
	const [rect, setRect] = useState<FrameRect | null>(null)

	useLayoutEffect(() => {
		const container = containerRef.current
		const child = childRef.current
		if (!container || !child) return
		const measure = () => {
			const frame = container.getBoundingClientRect()
			const box = child.getBoundingClientRect()
			if (!frame.width || !frame.height) return
			setRect({
				x: (box.left - frame.left) / frame.width,
				y: (box.top - frame.top) / frame.height,
				w: box.width / frame.width,
				h: box.height / frame.height
			})
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(container)
		return () => observer.disconnect()
	}, [containerRef, childRef])

	return rect
}
