import {
	Avatar,
	AvatarFallback,
	AvatarImage
} from '@shared/components/ui/avatar'
import { cn } from '@shared/utils'

interface Author {
	name: string
	role?: string
	avatar?: string
}

interface AuthorChipProps {
	author: Author
	/** Omits the avatar, for the tight footers on article cards. */
	compact?: boolean
	className?: string
}

function initials(name: string) {
	return name
		.split(' ')
		.map((part) => part.charAt(0))
		.join('')
		.slice(0, 2)
		.toUpperCase()
}

/**
 * An author's name and role, with or without their avatar.
 *
 * Four variants existed: two on the article page (the byline and the hover
 * card, identical markup written twice) and two on the index, where the
 * featured card stacked name over role and the grid cards ran them inline at
 * different weights.
 *
 * Both variants sit on scale rungs rather than raw Tailwind sizes. The name was
 * `font-semibold`, a 600 the scale never uses - every rung it defines is 500 -
 * so the byline read heavier than the h3 article titles above it.
 */
export function AuthorChip({ author, compact, className }: AuthorChipProps) {
	if (compact) {
		return (
			<div className={cn('text-label-xs flex items-center gap-1.5', className)}>
				<span className="font-medium">{author.name}</span>
				{author.role ? (
					<span className="text-muted-foreground">{author.role}</span>
				) : null}
			</div>
		)
	}

	return (
		<div className={cn('flex items-center gap-2 text-left', className)}>
			<Avatar className="h-11 w-11">
				{author.avatar ? (
					<AvatarImage src={author.avatar} alt={author.name} />
				) : null}
				<AvatarFallback>{initials(author.name)}</AvatarFallback>
			</Avatar>
			<div>
				<p className="text-h4">{author.name}</p>
				{author.role ? (
					// `text-label-xs` sets no weight, so the role inherited 500 from the
					// byline's Button and 400 inside the card - one chip, two weights.
					<p className="text-muted-foreground text-label-xs font-normal">
						{author.role}
					</p>
				) : null}
			</div>
		</div>
	)
}
