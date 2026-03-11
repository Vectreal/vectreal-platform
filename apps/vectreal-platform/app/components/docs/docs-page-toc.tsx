import { cn } from '@shared/utils'

import type { DocHeading } from '../../hooks/use-doc-toc'
import type { MouseEvent } from 'react'

interface DocsPageTocProps {
	headings: DocHeading[]
	activeId: string | null
	onNavigate?: () => void
}

export function DocsPageToc({
	headings,
	activeId,
	onNavigate
}: DocsPageTocProps) {
	function handleTocClick(
		event: MouseEvent<HTMLAnchorElement>,
		headingId: string
	) {
		event.preventDefault()
		onNavigate?.()

		requestAnimationFrame(() => {
			const heading = document.getElementById(headingId)
			if (!heading) {
				return
			}

			heading.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			})

			history.replaceState(null, '', `#${headingId}`)
		})
	}

	if (headings.length === 0) {
		return (
			<p className="text-muted-foreground px-1 text-sm">
				No sections on this page.
			</p>
		)
	}

	return (
		<ul className="space-y-1">
			{headings.map((heading) => (
				<li key={heading.id}>
					<a
						href={`#${heading.id}`}
						onClick={(event) => handleTocClick(event, heading.id)}
						className={cn(
							'hover:text-foreground block rounded-md px-2 py-1 text-sm transition-colors',
							heading.level === 3 && 'pl-5',
							activeId === heading.id
								? 'bg-muted text-foreground font-medium'
								: 'text-muted-foreground'
						)}
					>
						{heading.title}
					</a>
				</li>
			))}
		</ul>
	)
}
