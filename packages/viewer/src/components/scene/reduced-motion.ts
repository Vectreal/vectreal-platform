const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Whether the visitor asked for reduced motion.
 *
 * Read when a camera switch starts rather than held in React state: the answer
 * is current for every flight, and the transition callback that reads it keeps
 * its identity, which effects depend on.
 */
export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia(REDUCED_MOTION_QUERY).matches
	)
}
