import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator
} from '@shared/components/ui/breadcrumb'
import { Button } from '@shared/components/ui/button'
import { ScrollArea } from '@shared/components/ui/scroll-area'
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { useRef } from 'react'
import { type MetaFunction, Link, Outlet, useLocation } from 'react-router'

import { DocsMobileNavigation } from '../../components/docs/docs-mobile-navigation'
import { DocsPageToc } from '../../components/docs/docs-page-toc'
import { DocsTreeNav } from '../../components/docs/docs-tree-nav'
import { useDocToc } from '../../hooks/use-doc-toc'
import {
	DOC_CATEGORY_LABELS,
	GITHUB_REPO,
	GITHUB_DEFAULT_BRANCH,
	editOnGithubUrl,
	getAdjacentDocPages,
	getDocPage
} from '../../lib/docs/docs-manifest'
import { buildMeta, getRootMeta } from '../../lib/seo'
import styles from '../../styles/mdx.module.css'

import type { RootLoader } from '../../root'

export const meta: MetaFunction<undefined, { root: RootLoader }> = (
	rootLoaderData
) =>
	buildMeta(
		[{ title: 'Docs — Vectreal Platform' }],
		getRootMeta(rootLoaderData),
		{ private: false }
	)

/**
 * DocsLayout — wraps all /docs/* routes.
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
	const { headings, activeId } = useDocToc(contentRef, pathname)

	function toDocHref(docSlug: string) {
		return `/docs${docSlug ? `/${docSlug}` : ''}`
	}

	const slugParts = slug.split('/').filter(Boolean)
	const categorySlug = slugParts[0] as
		| keyof typeof DOC_CATEGORY_LABELS
		| undefined
	const categoryLabel = categorySlug
		? DOC_CATEGORY_LABELS[categorySlug]
		: undefined

	return (
		<div className="mx-auto flex w-full max-w-7xl gap-0 px-4 pt-22 pb-16">
			<aside
				className="sticky top-20 hidden h-[calc(100vh-5rem)] w-64 shrink-0 lg:block"
				aria-label="Docs navigation"
			>
				<ScrollArea className="h-full pr-4 pb-8">
					<DocsTreeNav pathname={pathname} />
				</ScrollArea>
			</aside>

			<main className="min-w-0 flex-1 lg:px-8">
				<DocsMobileNavigation
					pathname={pathname}
					headings={headings}
					activeId={activeId}
				/>

				<div className="mb-4 flex items-center justify-between gap-3">
					<Breadcrumb aria-label="Docs breadcrumb">
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink asChild>
									<Link to="/docs" viewTransition>
										Docs
									</Link>
								</BreadcrumbLink>
							</BreadcrumbItem>
							{categoryLabel && (
								<>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										<BreadcrumbLink asChild>
											<Link to={`/docs/${categorySlug}`} viewTransition>
												{categoryLabel}
											</Link>
										</BreadcrumbLink>
									</BreadcrumbItem>
								</>
							)}
							{page?.title &&
								page.title !== categoryLabel &&
								page.title !== 'Documentation' && (
									<>
										<BreadcrumbSeparator />
										<BreadcrumbItem>
											<BreadcrumbPage>{page.title}</BreadcrumbPage>
										</BreadcrumbItem>
									</>
								)}
						</BreadcrumbList>
					</Breadcrumb>
					<span className="border-border/60 bg-muted/50 text-foreground rounded-full border px-2.5 py-0.5 text-xs font-medium">
						{page?.version ?? 'latest'}
					</span>
				</div>

				<article ref={contentRef} className={styles.docsContent}>
					<Outlet />
				</article>

				<div className="border-border/60 mt-12 flex flex-col gap-5 border-t pt-6">
					<div className="flex items-center justify-between gap-3">
						{previous ? (
							<Button variant="ghost" asChild className="h-10 px-3 py-2">
								<Link
									to={toDocHref(previous.slug)}
									viewTransition
									className="group"
								>
									<span className="text-muted-foreground group-hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors">
										<ChevronLeft className="h-4 w-4" aria-hidden="true" />
										{previous.title}
									</span>
								</Link>
							</Button>
						) : (
							<span className="h-10 w-10" />
						)}

						{next ? (
							<Button variant="ghost" asChild className="h-10 px-3 py-2">
								<Link
									to={toDocHref(next.slug)}
									viewTransition
									className="group"
								>
									<span className="text-muted-foreground group-hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors">
										{next.title}
										<ChevronRight className="h-4 w-4" aria-hidden="true" />
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
				className="sticky top-20 hidden h-[calc(100vh-5rem)] w-64 shrink-0 xl:block"
				aria-label="On this page"
			>
				<div className="border-border/50 h-full border-l pl-4">
					<p className="text-muted-foreground mb-3 px-1 text-xs font-semibold tracking-wider uppercase">
						On this page
					</p>
					<ScrollArea className="h-[calc(100vh-8rem)] pr-2 pb-8">
						<DocsPageToc headings={headings} activeId={activeId} />
					</ScrollArea>
				</div>
			</aside>
		</div>
	)
}
