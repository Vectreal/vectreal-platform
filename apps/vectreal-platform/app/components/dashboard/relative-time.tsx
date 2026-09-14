/**
 * How long ago, in one vocabulary, for the whole dashboard.
 *
 * There were four of these and they answered the same question three ways. A
 * scene card said `Edited 3h ago`; a project card said `Updated today`; the
 * usage page said `changed today`; the api-keys table said `3h ago` or
 * `Just now`. Same dashboard, same question, and the answer changed depending
 * on which surface asked - `today` on one card and `5h ago` on the one beside
 * it, for rows an hour apart.
 *
 * The phrase alone lives here. The word in front of it - Edited, Updated,
 * changed, Unused since rotating - belongs to the sentence the caller is
 * writing, which is why this used to carry an `inline` flag that lowercased
 * its own first letter to be usable mid-sentence. A formatter that has to undo
 * its own prefix is a formatter that should not have one.
 *
 * `formatRelativeDeadline` in `table-columns.tsx` deliberately stays separate:
 * it reads forward (`in 3 days`, `tomorrow`) and feeding a future date to this
 * one produces a negative that formats as `0 min ago`. Its own comment already
 * made that argument; this file is the past tense.
 *
 * **`Date.now()` at render time is why the component exists.** Every dashboard
 * page is server-rendered, so the string is produced once on the server and
 * again at hydration, and anything near a bucket boundary can cross it in the
 * gap. `suppressHydrationWarning` is React's designated answer - a timestamp is
 * its canonical example - and it keeps the server's text rather than flashing
 * one phrasing into another on every load. Three of the four formatters this
 * replaces were bare functions rendering straight into JSX, so the sites that
 * now use this component gain that guard rather than losing anything.
 */

/** Minutes, hours, days, then a date. The absolute form takes over at 30 days. */
export function formatRelativeTime(at: Date | string): string {
	const date = at instanceof Date ? at : new Date(at)
	const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)

	if (minutes < 1) return 'just now'
	if (minutes < 60) return `${minutes} min ago`
	if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
	if (minutes < 43_200) return `${Math.floor(minutes / 1440)}d ago`

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})
}

interface RelativeTimeProps {
	at: Date | string
	className?: string
}

/** The phrase, in a `<time>`, safe to render on a server-rendered page. */
export function RelativeTime({ at, className }: RelativeTimeProps) {
	const date = at instanceof Date ? at : new Date(at)

	return (
		<time
			dateTime={date.toISOString()}
			className={className}
			suppressHydrationWarning
		>
			{formatRelativeTime(date)}
		</time>
	)
}
