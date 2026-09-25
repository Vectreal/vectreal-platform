import { Link } from 'react-router'

import { docsNavItemClasses } from './docs-nav-item'
import {
	DOC_AUDIENCES,
	DOC_CATEGORY_LABELS,
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
			{/* Grouped by what the reader is doing, so the browser's pages are not read as the preamble to repo setup. */}
			{DOC_AUDIENCES.map((audience) => (
				<section key={audience.id} aria-label={audience.label} className="mb-8">
					<p className="text-foreground mb-3 px-2 text-sm font-medium">
						{audience.label}
					</p>
					{audience.categories.map((category) => {
						const pages = navByCategory.get(category) ?? []
						if (pages.length === 0) return null

						return (
							<div key={category} className="mb-6">
								<p className="text-muted-foreground text-eyebrow mb-2 px-2">
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
													className={docsNavItemClasses(isActive)}
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
				</section>
			))}
		</nav>
	)
}
