import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator
} from '@shared/components/ui/breadcrumb'
import { Menu } from 'lucide-react'
import { Link } from 'react-router'

import { DocsMobileNavigation } from './docs-mobile-navigation'
import { useDocsToc } from './docs-toc-context'
import { DOC_CATEGORY_LABELS, getDocPage } from '../../lib/docs/docs-manifest'

/**
 * Whether a path is a docs page: the nav is the docs bar there. The pages
 * under `/docs/`, which the docs layout wraps; the landing at `/docs` is a
 * page of its own, with the contents on the page and no rail to stand in for.
 */
export function isDocsPath(pathname: string) {
	return pathname.startsWith('/docs/')
}

/**
 * Where the reader is in the docs, in the site nav's bar.
 *
 * The docs used to put this in a second bar pinned under the nav, so a docs
 * page carried two strips of chrome. It is worked out from the path alone, so
 * it renders on the server with everything else in the bar.
 *
 * Below `xl`, the first crumb opens the docs sheet, the tree and the page's
 * contents, since neither rail is on screen there.
 */
export function DocsBreadcrumb({
	pathname,
	compact = false
}: {
	pathname: string
	/** The phone bar: only the sheet trigger fits. */
	compact?: boolean
}) {
	const { headings, activeId } = useDocsToc()
	const slug = pathname.replace(/^\/docs\/?/, '').replace(/\/$/, '')
	const page = getDocPage(slug)
	const categorySlug = slug.split('/').filter(Boolean)[0] as
		keyof typeof DOC_CATEGORY_LABELS | undefined
	const categoryLabel = categorySlug
		? DOC_CATEGORY_LABELS[categorySlug]
		: undefined
	const categoryPage = categorySlug ? getDocPage(categorySlug) : undefined

	const sheet = (
		<DocsMobileNavigation
			pathname={pathname}
			headings={headings}
			activeId={activeId}
		>
			{/* A real button: `SheetTrigger asChild` adds no tabIndex of its own, and below xl this is the docs' whole navigation. */}
			<button
				type="button"
				className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
			>
				<Menu className="size-4" aria-hidden="true" /> Docs
			</button>
		</DocsMobileNavigation>
	)

	if (compact) return sheet

	return (
		<Breadcrumb aria-label="Docs breadcrumb" className="min-w-0">
			<BreadcrumbList className="flex-nowrap">
				<BreadcrumbItem>
					{/* Two spellings of one crumb, never both: the link where the rails are on screen, the sheet where they are not. */}
					<BreadcrumbLink asChild className="max-xl:hidden">
						<Link to="/docs" viewTransition>
							Docs
						</Link>
					</BreadcrumbLink>
					<span className="xl:hidden">{sheet}</span>
				</BreadcrumbItem>
				{categoryLabel && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							{categoryPage ? (
								<BreadcrumbLink asChild>
									<Link to={`/docs/${categorySlug}`} viewTransition>
										{categoryLabel}
									</Link>
								</BreadcrumbLink>
							) : (
								<BreadcrumbPage>{categoryLabel}</BreadcrumbPage>
							)}
						</BreadcrumbItem>
					</>
				)}
				{page?.title && page.title !== categoryLabel && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem className="min-w-0">
							<BreadcrumbPage className="truncate">{page.title}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	)
}
