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
 */
export function AuthorChip({ author, compact, className }: AuthorChipProps) {
	if (compact) {
		return (
			<div className={cn('flex items-center gap-1.5', className)}>
				<span className="text-xs font-semibold">{author.name}</span>
				{author.role ? (
					<span className="text-muted-foreground text-xs">{author.role}</span>
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
				<p className="text-sm font-semibold tracking-tight">{author.name}</p>
				{author.role ? (
					<p className="text-muted-foreground text-xs">{author.role}</p>
				) : null}
			</div>
		</div>
	)
}
