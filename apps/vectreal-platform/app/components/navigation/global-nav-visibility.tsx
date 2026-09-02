import { createContext, useContext, useEffect, type ReactNode } from 'react'

/**
 * Runtime escape hatch for the one nav-visibility case the URL cannot express.
 *
 * `routePageChrome` decides chrome from the path, which is what keeps SSR and
 * hydration in agreement. The publisher has a single transition outside that
 * model: dropping a model at `/publisher` hands the top of the viewport to
 * `PublisherHeader` without navigating.
 *
 * Hide-only by design. A channel that could also turn the nav back *on* would be
 * able to reveal it a frame after paint, which is exactly the flash this work
 * removes. Restoring the nav is the cleanup's job, not a caller's.
 *
 * Single-consumer by design too: `controls-overlay` is the only caller, so there
 * is no reference counting. Add it when a second consumer actually exists.
 */
const HideGlobalNavContext = createContext<((hidden: boolean) => void) | null>(
	null
)

export function GlobalNavVisibilityProvider({
	onHiddenChange,
	children
}: {
	onHiddenChange: (hidden: boolean) => void
	children: ReactNode
}) {
	return (
		<HideGlobalNavContext.Provider value={onHiddenChange}>
			{children}
		</HideGlobalNavContext.Provider>
	)
}

export function useHideGlobalNav(hidden: boolean): void {
	const setHidden = useContext(HideGlobalNavContext)
	if (!setHidden) {
		throw new Error(
			'useHideGlobalNav must be used inside GlobalNavVisibilityProvider'
		)
	}

	useEffect(() => {
		setHidden(hidden)
		return () => setHidden(false)
	}, [hidden, setHidden])
}
