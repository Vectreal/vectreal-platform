import { useCallback, useState } from 'react'

/**
 * Two live regions, used alternately, so a message can repeat.
 *
 * A live region speaks when its content changes, and React bails out of an
 * identical `setState`, so saying the same thing twice produced no DOM change
 * and no announcement - which is how "already first" spoke on the first
 * ArrowUp at the top of the list and went quiet on every one after it.
 *
 * Alternating a trailing zero-width space was the first attempt and does not
 * work: it saturates on the third repeat, and even before that it only
 * mutates one text node, which some screen readers report as an insertion of
 * the delta - here, an inaudible character. Writing each message into a region
 * that was empty makes every announcement an unambiguous insertion, which is
 * the technique `react-aria`'s announcer settled on for the same reason.
 *
 * A panel renders `regions` outside its drill-down, so an announcement made
 * from one view is not unmounted with it.
 */
export function useAnnouncer() {
	const [announcement, setAnnouncement] = useState<{
		message: string
		slot: 0 | 1
	}>({ message: '', slot: 0 })

	const announce = useCallback((message: string) => {
		setAnnouncement((previous) => ({
			message,
			slot: previous.slot === 0 ? 1 : 0
		}))
	}, [])

	const regions = ([0, 1] as const).map((slot) => (
		<span key={slot} role="status" aria-live="polite" className="sr-only">
			{announcement.slot === slot ? announcement.message : ''}
		</span>
	))

	return { announce, regions }
}
