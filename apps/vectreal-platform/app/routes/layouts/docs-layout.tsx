import { Button } from '@shared/components/ui/button'
import { ScrollArea } from '@shared/components/ui/scroll-area'
import { cn } from '@shared/utils'
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { useRef } from 'react'
import { type MetaFunction, Link, Outlet, useLocation } from 'react-router'

import { DocsPageToc } from '../../components/docs/docs-page-toc'
import { usePublishDocsToc } from '../../components/docs/docs-toc-context'
import { DocsTreeNav } from '../../components/docs/docs-tree-nav'
import { PublicErrorBoundary } from '../../components/errors'
import { useDocToc } from '../../hooks/use-doc-toc'
import {
	GITHUB_REPO,
	GITHUB_DEFAULT_BRANCH,
	editOnGithubUrl,
	getAdjacentDocPages,
	getDocPage,
	getDocTrail
} from '../../lib/docs/docs-manifest'
import { buildPageMeta, getRootMeta, SITE_URL } from '../../lib/seo'
import {
	buildBreadcrumbListJsonLd,
	buildDocsPageSeo,
	PUBLIC_SEO_PAGES
} from '../../lib/seo-registry'
import styles from '../../styles/mdx.module.css'

import type { RootLoader } from '../../root'

export const meta: MetaFunction<undefined, { root: RootLoader }> = (args) =>
	(() => {
		const slug = args.location.pathname
			.replace(/^\/docs\/?/, '')
			.replace(/\/$/, '')
		const { page, categoryLabel, categoryStart } = getDocTrail(slug)

		const breadcrumbItems = [
			{ name: 'Home', item: SITE_URL },
			{ name: 'Docs', item: `${SITE_URL}/docs` },
			...(categoryLabel && categoryStart && categoryStart.slug !== slug
				? [
						{
							name: categoryLabel,
							item: `${SITE_URL}/docs/${categoryStart.slug}`
						}
					]
				: []),
			...(page && page.title !== categoryLabel ? [{ name: page.title }] : [])
		]

		if (!page) {
			return buildPageMeta(
				{
					...PUBLIC_SEO_PAGES.docs,
					canonical: args.location.pathname,
					structuredData: buildBreadcrumbListJsonLd(breadcrumbItems)
				},
				getRootMeta(args)
			)
		}

		return buildPageMeta(
			{
				...buildDocsPageSeo({
					pathname: args.location.pathname,
					title: page.title,
					description: page.description
				}),
				structuredData: buildBreadcrumbListJsonLd(breadcrumbItems)
			},
			getRootMeta(args)
		)
	})()

/**
 * DocsLayout - wraps all /docs/* routes.
 *
 * Renders:
 *  - A fixed left sidebar with grouped navigation
 *  - The MDX page content in the main area (reuses mdx.module.css styles)
 *  - An "Edit on GitHub" link + version badge anchored above the content
 */
export default function DocsLayout() {
	const { pathname } = useLocation()
	const contentRef = useRef<HTMLDivElement | null>(null)

	// Derive the slug from the URL: strip the leading "/docs" segment.
	const slug = pathname.replace(/^\/docs\/?/, '').replace(/\/$/, '')

	const page = getDocPage(slug)
	const editUrl = page ? editOnGithubUrl(page.sourcePath) : null
	const { previous, next } = getAdjacentDocPages(slug)
	const toc = useDocToc(contentRef, pathname)
	// The bar is the site nav's now, and below xl its sheet lists this page's contents.
	usePublishDocsToc(toc)
	const { headings, activeId } = toc

	function toDocHref(docSlug: string) {
		return `/docs${docSlug ? `/${docSlug}` : ''}`
	}

	return (
		<div className="container-page flex gap-0 pb-16">
			<aside
				className="sticky top-20 hidden h-[calc(100dvh-5rem)] w-64 shrink-0 lg:block"
				aria-label="Docs navigation"
			>
				<ScrollArea className="h-full pr-4 pb-8">
					<DocsTreeNav pathname={pathname} />
				</ScrollArea>
			</aside>

			<main className="min-w-0 flex-1 lg:px-8">
				<article ref={contentRef} className={cn('mt-24', styles.docsContent)}>
					<Outlet />
				</article>

				<div className="mt-16 flex flex-col gap-5">
					<div className="flex items-center justify-between gap-3">
						{previous ? (
							<Button
								variant="ghost"
								asChild
								// At most half the row each, the title cut short: a button does not wrap, so a long title widened a phone's page.
								className="h-10 max-w-1/2 min-w-0 px-3 py-2"
							>
								<Link
									to={toDocHref(previous.slug)}
									viewTransition
									className="group"
								>
									<span className="text-muted-foreground group-hover:text-foreground inline-flex min-w-0 items-center gap-2 text-sm transition-colors">
										<ChevronLeft
											className="h-4 w-4 shrink-0"
											aria-hidden="true"
										/>
										<span className="truncate">{previous.title}</span>
									</span>
								</Link>
							</Button>
						) : (
							<span className="h-10 w-10" />
						)}

						{next ? (
							<Button
								variant="ghost"
								asChild
								// At most half the row each, the title cut short: a button does not wrap, so a long title widened a phone's page.
								className="h-10 max-w-1/2 min-w-0 px-3 py-2"
							>
								<Link
									to={toDocHref(next.slug)}
									viewTransition
									className="group"
								>
									<span className="text-muted-foreground group-hover:text-foreground inline-flex min-w-0 items-center gap-2 text-sm transition-colors">
										<span className="truncate">{next.title}</span>
										<ChevronRight
											className="h-4 w-4 shrink-0"
											aria-hidden="true"
										/>
									</span>
								</Link>
							</Button>
						) : (
							<span className="h-10 w-10" />
						)}
					</div>

					<div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-3 text-sm">
						{editUrl && (
							<Button
								variant="ghost"
								size="sm"
								asChild
								className="text-muted-foreground hover:text-foreground h-auto gap-1.5 px-2 py-1 text-xs"
							>
								<a
									href={editUrl}
									target="_blank"
									rel="noreferrer"
									aria-label={`Edit ${page?.title ?? 'this page'} on GitHub`}
								>
									<Pencil className="h-3 w-3" aria-hidden="true" />
									Edit on GitHub
								</a>
							</Button>
						)}

						{page?.sourcePath && (
							<a
								href={`${GITHUB_REPO}/tree/${GITHUB_DEFAULT_BRANCH}/${page.sourcePath}`}
								target="_blank"
								rel="noreferrer"
								className="text-muted-foreground/60 hover:text-muted-foreground font-mono text-xs transition-colors"
								aria-label="View source file on GitHub"
							>
								{page.sourcePath}
							</a>
						)}
					</div>
				</div>
			</main>

			<aside
				className="sticky top-20 hidden h-[calc(100dvh-5rem)] w-64 shrink-0 xl:block"
				aria-label="On this page"
			>
				<div className="h-full pl-4">
					<p className="text-muted-foreground text-eyebrow mb-3 px-1">
						On this page
					</p>
					<ScrollArea className="h-[calc(100dvh-8rem)] pr-2 pb-8">
						<DocsPageToc headings={headings} activeId={activeId} />
					</ScrollArea>
				</div>
			</aside>
		</div>
	)
}

/*
  This layout owns 13 MDX routes and the TOC hook that runs on all of them, and
  it was the one place the boundary was not exported - every leaf route had it.
  Without it a throw here reaches root.tsx's last-resort fallback, which renders
  the raw error string on a bare document whose `error` class is defined in no
  stylesheet.
*/
export { PublicErrorBoundary as ErrorBoundary }
