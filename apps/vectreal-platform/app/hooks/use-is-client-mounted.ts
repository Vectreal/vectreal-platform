import { useEffect, useState } from 'react'

/**
 * False during SSR and the first client render, true afterwards.
 *
 * Radix dropdown and popover triggers cannot be interacted with before
 * hydration, so every actions cell renders a disabled trigger until this flips.
 * Four copies of the same three lines lived across the table columns and
 * dashboard actions before this.
 *
 * Not for a trigger that overlays a link. `Button` renders `disabled` as
 * `pointer-events: none`, so the tap does not stop at the trigger - it reaches
 * whatever is underneath. In a table cell that is nothing; on `EntityCard` it
 * is a link covering the whole card, and the user gets a navigation they did
 * not ask for. There, leave the trigger enabled: it absorbs the tap and does
 * nothing, which is what an un-hydrated control does everywhere else.
 */
export function useIsClientMounted(): boolean {
	const [isMounted, setIsMounted] = useState(false)

	useEffect(() => {
		setIsMounted(true)
	}, [])

	return isMounted
}
