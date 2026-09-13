/**
 * When a thing last moved, in the register a person actually asks it in.
 *
 * This existed twice, byte for byte, in two files in this directory - the scene
 * card and the resume band - because both answer the same question about the
 * same row from the same loader.
 *
 * `Date.now()` at render time is why it needs a component rather than a bare
 * function. `/dashboard` is server-rendered, so the string is produced once on
 * the server and again at hydration, and any scene inside the minute bucket can
 * cross a boundary in the gap between them. One instance of that was tolerable;
 * the card grid made it ten on one page. `suppressHydrationWarning` is React's
 * designated answer for exactly this - a timestamp is its canonical example -
 * and it keeps the server's text rather than flashing an absolute date into a
 * relative one on every load.
 */

export function formatRelativeEdit(updatedAt: Date | string): string {
	const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt)
	const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)

	if (minutes < 1) return 'Edited just now'
	if (minutes < 60) return `Edited ${minutes} min ago`
	if (minutes < 1440) return `Edited ${Math.floor(minutes / 60)}h ago`
	if (minutes < 43_200) return `Edited ${Math.floor(minutes / 1440)}d ago`

	return `Edited ${date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})}`
}

interface RelativeEditTimeProps {
	updatedAt: Date | string
	className?: string
	/** Lowercases the first letter, for use mid-sentence after a separator. */
	inline?: boolean
}

export function RelativeEditTime({
	updatedAt,
	className,
	inline = false
}: RelativeEditTimeProps) {
	const text = formatRelativeEdit(updatedAt)
	const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt)

	return (
		<time
			dateTime={date.toISOString()}
			className={className}
			suppressHydrationWarning
		>
			{inline ? text.charAt(0).toLowerCase() + text.slice(1) : text}
		</time>
	)
}
