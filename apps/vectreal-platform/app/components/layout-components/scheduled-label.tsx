import { useIsClientMounted } from '../../hooks/use-is-client-mounted'
import { formatScheduledFor, isScheduledAt } from '../../lib/news/news-schedule'

import type { CSSProperties } from 'react'

interface ScheduledLabelProps {
	publishedAt: string
	className?: string
	style?: CSSProperties
}

/**
 * "Scheduled for <date and time>" on an article that is not live yet.
 *
 * Only staging ever shows one: production does not serve a scheduled article
 * before its time. It is decided in the browser, after hydration, because the
 * article pages are prerendered once at build time, when every scheduled
 * article is still in the future, so the server cannot know whether the time
 * has passed by the time someone reads the page.
 */
export function ScheduledLabel({
	publishedAt,
	className,
	style
}: ScheduledLabelProps) {
	const isMounted = useIsClientMounted()

	if (!isMounted || !isScheduledAt(publishedAt, Date.now())) return null

	return (
		<p className={className} style={style}>
			{formatScheduledFor(publishedAt)}
		</p>
	)
}
