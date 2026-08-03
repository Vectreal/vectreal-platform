import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

/**
 * Open state for a drawer whose visibility *is* a route.
 *
 * These drawers used to navigate straight out of `onOpenChange`, which is why
 * they vanished instead of sliding away: React Router unmounts the route on
 * navigation, so the element vaul wants to animate is already gone by the time
 * the exit transition would run. Closing looked like a hard cut on every one of
 * them.
 *
 * So the close happens in two steps. Local state closes the drawer, vaul plays
 * its exit animation on a still-mounted element, and only when that finishes
 * does the navigation run.
 *
 * @param isOpen Whether the current route is this drawer's route.
 * @param closeTo Where closing should land.
 */
export function useRouteDrawer({
	isOpen,
	closeTo,
	replace = false
}: {
	isOpen: boolean
	closeTo: string
	replace?: boolean
}) {
	const navigate = useNavigate()
	const [open, setOpen] = useState(isOpen)
	const navigateTimerRef = useRef<number | null>(null)

	// Follow the route in both directions, so a back button or a link elsewhere
	// closes the drawer with the same animation as its own close button.
	useEffect(() => {
		setOpen(isOpen)
	}, [isOpen])

	const clearNavigateTimer = () => {
		if (navigateTimerRef.current !== null) {
			window.clearTimeout(navigateTimerRef.current)
			navigateTimerRef.current = null
		}
	}

	useEffect(() => clearNavigateTimer, [])

	const leave = useCallback(() => {
		clearNavigateTimer()
		navigate(closeTo, { replace })
	}, [closeTo, navigate, replace])

	const close = useCallback(() => {
		setOpen(false)

		/*
		  A fallback, not the mechanism. `onAnimationEnd` is what normally triggers
		  the navigation, but if it never fires - a browser that skips the
		  transition under reduced motion, an interrupted animation - the drawer
		  would sit closed on a route that still says it is open, and the close
		  button would look broken. Well clear of vaul's ~500ms exit.
		*/
		clearNavigateTimer()
		navigateTimerRef.current = window.setTimeout(leave, 700)
	}, [leave])

	return {
		open,
		/** Pass to `Drawer`. Closing is local; the route changes afterwards. */
		onOpenChange: (next: boolean) => {
			if (!next) {
				close()
			}
		},
		/** Pass to `Drawer`. Fires for both directions, so the close is filtered. */
		onAnimationEnd: (opened: boolean) => {
			if (opened) {
				return
			}
			// Guard against navigating twice when the route already moved on -
			// closing via the back button lands here with nothing left to do.
			if (isOpen) {
				leave()
			}
		},
		/** For a Cancel button, which should animate out rather than jump. */
		close
	}
}
