import { cn } from '@shared/utils'

/**
 * The shape of a navigable row in the docs rails.
 *
 * The tree nav and the page TOC each had their own version, and they disagreed
 * on the padding (`py-1.5` vs `py-1`), on what hover does (background in one,
 * colour in the other) and on the tint - `bg-muted/60` for hover against
 * `bg-muted` for the selected row, so a hovered item and a selected item were
 * two steps of the same improvised colour.
 *
 * Both states now use `--accent`, which is what that token is for: a neutral
 * hover and selection surface, distinct from the brand orange.
 */
export function docsNavItemClasses(
	isActive: boolean,
	className?: false | string
) {
	return cn(
		'block rounded-lg px-2 py-1.5 text-sm transition-colors',
		'hover:bg-accent hover:text-foreground',
		isActive ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground',
		className
	)
}
