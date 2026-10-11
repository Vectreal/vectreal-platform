import { useEffect, useState, type RefObject } from 'react'

/**
 * True once `ref`'s element has been on screen and the browser has then gone
 * idle, so a heavy client-only surface mounts without competing with the first
 * paint. Stays true from then on.
 */
export function useMountWhenVisibleAndIdle(
	ref: RefObject<Element | null>
): boolean {
	const [wanted, setWanted] = useState(false)

	useEffect(() => {
		const element = ref.current
		if (!element) return
		// Safari has no idle callback; a short timeout stands in for it.
		const hasIdle = typeof window.requestIdleCallback === 'function'
		let idle = 0
		const observer = new IntersectionObserver(([entry]) => {
			if (!entry.isIntersecting) return
			observer.disconnect()
			const mount = () => setWanted(true)
			idle = hasIdle
				? window.requestIdleCallback(mount, { timeout: 1500 })
				: window.setTimeout(mount, 200)
		})
		observer.observe(element)
		return () => {
			observer.disconnect()
			if (hasIdle) window.cancelIdleCallback(idle)
			else window.clearTimeout(idle)
		}
	}, [ref])

	return wanted
}
