import { cn } from '@shared/utils'
import { Link } from 'react-router'

import {
	DOC_CATEGORY_LABELS,
	DOC_CATEGORY_ORDER,
	getDocsByCategory
} from '../../lib/docs/docs-manifest'

interface DocsTreeNavProps {
	pathname: string
	onNavigate?: () => void
}

const navByCategory = getDocsByCategory()

function toDocHref(docSlug: string) {
	return `/docs${docSlug ? `/${docSlug}` : ''}`
}

export function DocsTreeNav({ pathname, onNavigate }: DocsTreeNavProps) {
	return (
		<nav>
			{DOC_CATEGORY_ORDER.map((category) => {
				const pages = navByCategory.get(category) ?? []
				if (pages.length === 0) return null

				return (
					<div key={category} className="mb-6">
						<p className="text-muted-foreground mb-2 px-2 text-xs font-semibold tracking-wider uppercase">
							{DOC_CATEGORY_LABELS[category]}
						</p>
						<ul className="space-y-0.5">
							{pages.map((docPage) => {
								const href = toDocHref(docPage.slug)
								const isActive = pathname === href

								return (
									<li key={docPage.slug}>
										<Link
											to={href}
											viewTransition
											onClick={onNavigate}
											className={cn(
												'hover:bg-muted/60 block rounded-lg px-2 py-1.5 text-sm transition-colors',
												isActive
													? 'bg-muted text-foreground font-medium'
													: 'text-muted-foreground'
											)}
											aria-current={isActive ? 'page' : undefined}
										>
											{docPage.title}
										</Link>
									</li>
								)
							})}
						</ul>
					</div>
				)
			})}
		</nav>
	)
}
