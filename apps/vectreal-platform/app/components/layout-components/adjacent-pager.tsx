import { cn } from '@shared/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

interface AdjacentLink {
	to: string
	title: string
}

interface AdjacentPagerProps {
	label?: string
	previous?: AdjacentLink | null
	next?: AdjacentLink | null
	className?: string
}

interface PagerLinkProps {
	link: AdjacentLink
	direction: 'previous' | 'next'
}

function PagerLink({ link, direction }: PagerLinkProps) {
	const isPrevious = direction === 'previous'
	const Chevron = isPrevious ? ChevronLeft : ChevronRight

	return (
		<Link
			to={link.to}
			title={`Go to ${direction} article: ${link.title}`}
			viewTransition
			className={cn(
				'group relative flex flex-col gap-2 px-8',
				!isPrevious && 'items-end text-right'
			)}
		>
			<Chevron
				className={cn(
					'absolute top-1/2 h-6 w-6 -translate-y-1/2 opacity-50 transition-opacity group-hover:opacity-100',
					isPrevious ? 'left-0' : 'right-0'
				)}
				aria-hidden="true"
			/>
			<p className="text-muted-foreground text-eyebrow">
				{isPrevious ? 'Previous' : 'Next'}
			</p>
			<p className="text-sm leading-snug font-medium opacity-50 transition-opacity group-hover:opacity-100">
				{link.title}
			</p>
		</Link>
	)
}

/**
 * Previous/next links at the foot of a reading page.
 *
 * Written out twice, and the newsroom copy titled its *previous* link "Go to
 * previous article: {next.title}" - a copy-paste that put the wrong title in
 * the tooltip and in the accessible name. Deriving both sides from one
 * component is what makes that class of bug unwritable.
 */
export function AdjacentPager({
	label = 'Continue reading',
	previous,
	next,
	className
}: AdjacentPagerProps) {
	if (!previous && !next) return null

	return (
		<div className={cn('flex flex-col gap-6', className)}>
			{/*
			  A rule rather than a value step: this one separates two parts of the
			  same column, which is the case `ds-divider` exists for. It is a 1px
			  element because the token is a background, not a border colour.
			*/}
			<div className="ds-divider h-px" />
			<p className="text-muted-foreground text-eyebrow">{label}</p>
			<div className="grid gap-3 md:grid-cols-2">
				{previous ? (
					<PagerLink link={previous} direction="previous" />
				) : (
					<span />
				)}
				{next ? <PagerLink link={next} direction="next" /> : <span />}
			</div>
		</div>
	)
}
