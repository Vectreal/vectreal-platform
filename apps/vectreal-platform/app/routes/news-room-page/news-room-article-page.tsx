import {
	Avatar,
	AvatarFallback,
	AvatarImage
} from '@shared/components/ui/avatar'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { ScrollArea } from '@shared/components/ui/scroll-area'
import { cn } from '@shared/utils'
import { ChevronLeft, ChevronRight, Copy, Share2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { data, Link } from 'react-router'

import { DocsPageToc } from '../../components/docs/docs-page-toc'
import { useDocToc } from '../../hooks/use-doc-toc'
import {
	formatNewsDate,
	getAdjacentNewsArticles,
	getNewsArticle,
	getRelatedNewsArticles
} from '../../lib/news/news-manifest'
import { buildPageMeta } from '../../lib/seo'
import { buildNewsArticleJsonLd } from '../../lib/seo-registry'
import styles from '../../styles/mdx.module.css'

import type { Route } from './+types/news-room-article-page'

function initials(name: string): string {
	return name
		.split(' ')
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('')
}

export async function loader({ params }: Route.LoaderArgs) {
	const slug = params.slug ?? ''
	const article = getNewsArticle(slug)

	if (!article) {
		throw new Response('Article not found', { status: 404 })
	}

	const { Component: _, ...serializableArticle } = article
	const adjacent = getAdjacentNewsArticles(slug)
	const related = getRelatedNewsArticles(slug, 3).map(
		({ Component, ...entry }) => entry
	)

	return data({
		article: serializableArticle,
		adjacent: {
			previous: adjacent.previous
				? (({ Component, ...entry }) => entry)(adjacent.previous)
				: undefined,
			next: adjacent.next
				? (({ Component, ...entry }) => entry)(adjacent.next)
				: undefined
		},
		related
	})
}

export function meta({ data }: Route.MetaArgs) {
	if (!data) {
		return buildPageMeta({
			title: 'Article not found - Vectreal',
			description: 'This news article is no longer available.',
			canonical: '/news-room'
		})
	}

	const title = `${data.article.title} - Vectreal News Room`
	const description = data.article.excerpt
	const canonical = `/news-room/${data.article.slug}`

	return buildPageMeta({
		title,
		description,
		canonical,
		type: 'article',
		image: data.article.coverImage,
		imageAlt: data.article.title,
		structuredData: buildNewsArticleJsonLd({
			title: data.article.title,
			description,
			canonicalPath: canonical,
			publishedAt: data.article.publishedAt,
			updatedAt: data.article.updatedAt,
			image: data.article.coverImage,
			authorName: data.article.author.name
		})
	})
}

export default function NewsRoomArticlePage({
	loaderData
}: Route.ComponentProps) {
	const { article, adjacent, related } = loaderData
	const fullArticle = useMemo(
		() => getNewsArticle(article.slug),
		[article.slug]
	)
	const ArticleComponent = fullArticle?.Component
	const contentRef = useRef<HTMLDivElement | null>(null)
	const { headings, activeId } = useDocToc(contentRef, article.slug)
	const [copied, setCopied] = useState(false)

	function copyArticleLink() {
		if (typeof navigator === 'undefined') {
			return
		}

		const currentUrl = window.location.href
		navigator.clipboard
			.writeText(currentUrl)
			.then(() => {
				setCopied(true)
				setTimeout(() => setCopied(false), 1500)
			})
			.catch(() => {
				setCopied(false)
			})
	}

	if (!ArticleComponent) {
		return (
			<div className="mx-auto w-full max-w-4xl px-6 pt-28 pb-20 text-center">
				<h1 className="mb-2 text-2xl font-bold">Article unavailable</h1>
				<p className="text-muted-foreground mb-6">
					This article could not be rendered right now.
				</p>
				<Button asChild>
					<Link to="/news-room">Back to Newsroom</Link>
				</Button>
			</div>
		)
	}

	return (
		<div className="mx-auto flex w-full max-w-7xl gap-0 px-4 pt-22 pb-16">
			<main className="min-w-0 flex-1 lg:px-8">
				<Button variant="ghost" asChild className="mb-5 -ml-2">
					<Link to="/news-room" viewTransition>
						<ChevronLeft className="mr-1 h-4 w-4" />
						Newsroom
					</Link>
				</Button>

				<header className="bg-card/15 mb-8 rounded-2xl border border-[var(--color-border)]/60 p-6 md:p-7">
					<div className="mb-4 flex flex-wrap items-center gap-2">
						<Badge variant="outline" className="capitalize">
							{article.category}
						</Badge>
						{article.draft ? (
							<Badge variant="secondary" className="uppercase">
								Draft
							</Badge>
						) : null}
						<span className="text-muted-foreground text-xs">
							{formatNewsDate(article.publishedAt)}
						</span>
						{article.updatedAt && (
							<>
								<span className="text-muted-foreground text-xs">•</span>
								<span className="text-muted-foreground text-xs">
									Updated {formatNewsDate(article.updatedAt)}
								</span>
							</>
						)}
						<span className="text-muted-foreground text-xs">•</span>
						<span className="text-muted-foreground text-xs">
							{article.readingTimeMinutes} min read
						</span>
					</div>

					<h1 className="mb-3 max-w-4xl text-4xl leading-[1.08] font-black tracking-tight md:text-6xl">
						{article.title}
					</h1>
					<p className="text-muted-foreground max-w-3xl text-sm leading-relaxed md:text-base">
						{article.excerpt}
					</p>

					<div className="mt-6 flex flex-wrap items-center gap-3">
						<Avatar className="h-11 w-11 border border-[var(--color-border)]/70">
							{article.author.avatar ? (
								<AvatarImage
									src={article.author.avatar}
									alt={article.author.name}
								/>
							) : null}
							<AvatarFallback>{initials(article.author.name)}</AvatarFallback>
						</Avatar>
						<div>
							<p className="text-sm font-semibold">{article.author.name}</p>
							<p className="text-muted-foreground text-xs">
								{article.author.role}
							</p>
						</div>
						<div className="ml-auto flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={copyArticleLink}>
								<Copy className="mr-2 h-3.5 w-3.5" />
								{copied ? 'Copied' : 'Copy link'}
							</Button>
							<Button variant="outline" size="sm" asChild>
								<a
									href={`https://x.com/intent/tweet?url=${encodeURIComponent(`https://vectreal.com/news-room/${article.slug}`)}&text=${encodeURIComponent(article.title)}`}
									target="_blank"
									rel="noreferrer"
								>
									<Share2 className="mr-2 h-3.5 w-3.5" />
									Post
								</a>
							</Button>
						</div>
					</div>

					{article.author.bio && (
						<p className="text-muted-foreground mt-4 border-t border-[var(--color-border)]/50 pt-4 text-sm leading-relaxed">
							{article.author.bio}
						</p>
					)}
				</header>

				<article ref={contentRef} className={cn(styles.docsContent, 'mb-10')}>
					<ArticleComponent />
				</article>

				<div className="border-border/60 mt-12 flex flex-col gap-5 border-t pt-6">
					<div className="flex items-center justify-between gap-3">
						{adjacent.previous ? (
							<Button variant="ghost" asChild className="h-10 px-3 py-2">
								<Link
									to={`/news-room/${adjacent.previous.slug}`}
									viewTransition
									className="group"
								>
									<span className="text-muted-foreground group-hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors">
										<ChevronLeft className="h-4 w-4" aria-hidden="true" />
										{adjacent.previous.title}
									</span>
								</Link>
							</Button>
						) : (
							<span className="h-10 w-10" />
						)}

						{adjacent.next ? (
							<Button variant="ghost" asChild className="h-10 px-3 py-2">
								<Link
									to={`/news-room/${adjacent.next.slug}`}
									viewTransition
									className="group"
								>
									<span className="text-muted-foreground group-hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors">
										{adjacent.next.title}
										<ChevronRight className="h-4 w-4" aria-hidden="true" />
									</span>
								</Link>
							</Button>
						) : (
							<span className="h-10 w-10" />
						)}
					</div>
				</div>

				{related.length > 0 && (
					<section className="mt-12">
						<h2 className="mb-4 text-lg font-semibold tracking-tight">
							More from the newsroom
						</h2>
						<div className="grid gap-4 md:grid-cols-3">
							{related.map((item) => (
								<Link
									key={item.slug}
									to={`/news-room/${item.slug}`}
									className="border-border/70 bg-card/15 hover:border-border block rounded-xl border p-4 transition-colors"
								>
									<p className="text-muted-foreground mb-2 text-xs">
										{formatNewsDate(item.publishedAt)} •{' '}
										{item.readingTimeMinutes} min
									</p>
									<h3 className="mb-2 text-sm leading-snug font-semibold">
										{item.title}
									</h3>
									<p className="text-muted-foreground line-clamp-3 text-xs">
										{item.excerpt}
									</p>
								</Link>
							))}
						</div>
					</section>
				)}
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
