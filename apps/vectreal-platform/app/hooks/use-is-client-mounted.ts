import { useEffect, useState } from 'react'

/**
 * False during SSR and the first client render, true afterwards.
 *
 * Radix dropdown and popover triggers cannot be interacted with before
 * hydration, so every actions cell renders a disabled trigger until this flips.
 * Four copies of the same three lines lived across the table columns and
 * dashboard actions before this.
 */
export function useIsClientMounted(): boolean {
	const [isMounted, setIsMounted] = useState(false)

	useEffect(() => {
		setIsMounted(true)
	}, [])

	return isMounted
}
