import { cn } from '@shared/utils'

/**
 * A placeholder for content that has not arrived yet.
 *
 * The tint is a value laid over whatever surface it sits on, matching the
 * `ds-*` elevation utilities, rather than the `--muted` token. `--muted` is a
 * near-white in light mode, so a skeleton drawn with it all but vanished on a
 * raised surface.
 *
 * `rounded-lg` rather than `rounded-2xl`: most skeletons stand in for a line of
 * text, and a 1rem radius on a 1rem-tall bar renders as a lozenge.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="skeleton"
			aria-hidden
			className={cn(
				'bg-foreground/10 animate-skeleton-pulse rounded-lg',
				className
			)}
			{...props}
		/>
	)
}

export { Skeleton }
