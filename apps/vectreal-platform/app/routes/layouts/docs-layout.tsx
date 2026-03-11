import { Button } from '@shared/components/ui/button'
import { ScrollArea } from '@shared/components/ui/scroll-area'
import { cn } from '@shared/utils'
import { Pencil } from 'lucide-react'
import { type MetaFunction, Link, Outlet, useLocation } from 'react-router'

import { buildMeta, getRootMeta } from '../../lib/seo'
import {
	DOC_CATEGORY_LABELS,
	DOC_CATEGORY_ORDER,
	GITHUB_REPO,
	GITHUB_DEFAULT_BRANCH,
	editOnGithubUrl,
	getDocPage,
	getDocsByCategory
} from '../../lib/docs/docs-manifest'
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

// Pre-compute grouped navigation once per module load.
const navByCategory = getDocsByCategory()

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

	// Derive the slug from the URL: strip the leading "/docs" segment.
	const slug = pathname.replace(/^\/docs\/?/, '').replace(/\/$/, '')

	const page = getDocPage(slug)
	const editUrl = page ? editOnGithubUrl(page.sourcePath) : null

	return (
		<div className="flex min-h-screen flex-col">
			{/* ── Sidebar + Content grid ─────────────────────────────────────── */}
			<div className="mx-auto flex w-full max-w-7xl flex-1 gap-0 px-4 pt-20">
				{/* ── Sidebar ────────────────────────────────────────────────── */}
				<aside
					className="sticky top-20 hidden h-[calc(100vh-5rem)] w-64 shrink-0 lg:block"
					aria-label="Docs navigation"
				>
					<ScrollArea className="h-full pr-4 pb-8">
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
											{pages.map((p) => {
												const href = `/docs${p.slug ? `/${p.slug}` : ''}`
												const isActive = pathname === href || (p.slug === '' && pathname === '/docs')
												return (
													<li key={p.slug}>
														<Link
															to={href}
															viewTransition
															className={cn(
																'hover:bg-muted/60 block rounded-lg px-2 py-1.5 text-sm transition-colors',
																isActive
																	? 'bg-muted text-foreground font-medium'
																	: 'text-muted-foreground'
															)}
															aria-current={isActive ? 'page' : undefined}
														>
															{p.title}
														</Link>
													</li>
												)
											})}
										</ul>
									</div>
								)
							})}
						</nav>
					</ScrollArea>
				</aside>

				{/* ── Main content ───────────────────────────────────────────── */}
				<main className="min-w-0 flex-1 pb-20 lg:pl-8">
					{/* Page metadata bar */}
					<div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-3 text-sm">
						{/* Version badge */}
						<span className="border-border/60 bg-muted/50 rounded-full border px-2.5 py-0.5 text-xs font-medium">
							{page?.version ?? 'latest'}
						</span>

						{/* Edit on GitHub */}
						{editUrl && (
							<Button
								variant="ghost"
								size="sm"
								asChild
								className="text-muted-foreground hover:text-foreground h-auto gap-1.5 px-2 py-0.5 text-xs"
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

						{/* View source */}
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

					{/* MDX prose */}
					<div className={styles.docsContent}>
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	)
}
