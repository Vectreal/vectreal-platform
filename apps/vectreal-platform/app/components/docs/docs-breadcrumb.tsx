import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator
} from '@shared/components/ui/breadcrumb'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router'

import { DocsMobileNavigation } from './docs-mobile-navigation'
import { useDocsToc } from './docs-toc-context'
import { getDocTrail } from '../../lib/docs/docs-manifest'

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
 * contents, since neither rail is on screen there. It is a picker, not a
 * menu: it names where the reader is and carries the chevron the nav's own
 * panels do. On a phone the site menu's button sits beside it, and two menu
 * icons side by side read as the same control twice.
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
	const { page, categoryLabel, categoryStart } = getDocTrail(slug)
	const showTitle = Boolean(page?.title && page.title !== categoryLabel)

	const sheet = (label: string) => (
		<DocsMobileNavigation
			pathname={pathname}
			headings={headings}
			activeId={activeId}
		>
			{/* A real button: `SheetTrigger asChild` adds no tabIndex of its own, and below xl this is the docs' whole navigation. */}
			<button
				type="button"
				className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1 text-sm font-medium"
			>
				<span className="sr-only">Docs pages, current: </span>
				<span className="truncate">{label}</span>
				<ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
			</button>
		</DocsMobileNavigation>
	)

	// The phone bar has room for one crumb, so it is the page the reader is on.
	if (compact) return sheet(page?.title ?? categoryLabel ?? 'Docs')

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
					<span className="xl:hidden">{sheet('Docs')}</span>
				</BreadcrumbItem>
				{categoryLabel && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							{categoryStart && categoryStart.slug !== slug ? (
								<BreadcrumbLink asChild>
									<Link to={`/docs/${categoryStart.slug}`} viewTransition>
										{categoryLabel}
									</Link>
								</BreadcrumbLink>
							) : showTitle ? (
								// On its first page the category is where the reader already is: text, and the title after it is the current page.
								<span>{categoryLabel}</span>
							) : (
								<BreadcrumbPage>{categoryLabel}</BreadcrumbPage>
							)}
						</BreadcrumbItem>
					</>
				)}
				{page && showTitle && (
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
