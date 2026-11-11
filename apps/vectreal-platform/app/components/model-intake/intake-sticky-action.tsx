import { cn } from '@shared/utils'
import { useEffect, useState, type ReactNode } from 'react'

/** Marks a call to action already on the page; the sticky one hides while any is in view. */
export const INTAKE_ACTION_ATTRIBUTE = 'data-intake-action'

/**
 * The page's call to action, held at the bottom of a phone's screen once the
 * reader has scrolled past the hero's, and out of the way again whenever one
 * of the page's own buttons is in view. Wide screens never show it.
 */
export function IntakeStickyAction({ children }: { children: ReactNode }) {
	const [shown, setShown] = useState(false)

	useEffect(() => {
		const targets = document.querySelectorAll(`[${INTAKE_ACTION_ATTRIBUTE}]`)
		const inView = new Set<Element>()
		let seen = false
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) inView.add(entry.target)
				else inView.delete(entry.target)
				// Nothing before the hero's button has gone by.
				if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0)
					seen = true
			}
			setShown(seen && inView.size === 0)
		})
		targets.forEach((target) => observer.observe(target))
		return () => observer.disconnect()
	}, [])

	return (
		<div
			aria-hidden={!shown}
			inert={!shown}
			className={cn(
				'ds-overlay fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 backdrop-blur-sm transition-transform duration-300 lg:hidden',
				shown ? 'translate-y-0' : 'translate-y-full'
			)}
		>
			{children}
		</div>
	)
}
