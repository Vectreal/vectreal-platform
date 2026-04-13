import { usePostHog } from '@posthog/react'
import {
	Avatar,
	AvatarFallback,
	AvatarImage
} from '@shared/components/ui/avatar'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { ScrollArea } from '@shared/components/ui/scroll-area'
import { cn } from '@shared/utils'
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { data, Link } from 'react-router'

import { useConsent } from '../../components/consent/consent-context'
import { DocsPageToc } from '../../components/docs/docs-page-toc'
import { PublicErrorBoundary } from '../../components/errors'
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
	const posthog = usePostHog()
	const { consent } = useConsent()
	const fullArticle = useMemo(
		() => getNewsArticle(article.slug),
		[article.slug]
	)
	const ArticleComponent = fullArticle?.Component
	const contentRef = useRef<HTMLDivElement | null>(null)
	const viewTrackedRef = useRef(false)
	const scrollTrackedMilestones = useRef(new Set<number>())
	const maxScrollPercentRef = useRef(0)
	const startedAtRef = useRef(Date.now())
	const { headings, activeId } = useDocToc(contentRef, article.slug)
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		if (!consent?.analytics || viewTrackedRef.current) {
			return
		}

		viewTrackedRef.current = true
		posthog?.capture('newsroom_article_viewed', {
			slug: article.slug,
			category: article.category,
			reading_time_minutes: article.readingTimeMinutes,
			client_type: 'web'
		})
	}, [
		article.category,
		article.readingTimeMinutes,
		article.slug,
		consent?.analytics,
		posthog
	])

	useEffect(() => {
		if (!consent?.analytics) {
			return
		}

		const milestones = [25, 50, 75, 100]

		const updateScrollMilestones = () => {
			const doc = document.documentElement
			const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight)
			const percent = Math.min(
				100,
				Math.round((window.scrollY / scrollable) * 100)
			)

			maxScrollPercentRef.current = Math.max(
				maxScrollPercentRef.current,
				percent
			)

			for (const milestone of milestones) {
				if (
					percent >= milestone &&
					!scrollTrackedMilestones.current.has(milestone)
				) {
					scrollTrackedMilestones.current.add(milestone)
					posthog?.capture('newsroom_article_scroll_milestone', {
						slug: article.slug,
						milestone_percent: milestone,
						client_type: 'web'
					})
				}
			}
		}

		window.addEventListener('scroll', updateScrollMilestones, { passive: true })
		updateScrollMilestones()

		return () => {
			window.removeEventListener('scroll', updateScrollMilestones)
		}
	}, [article.slug, consent?.analytics, posthog])

	useEffect(() => {
		return () => {
			if (!consent?.analytics) {
				return
			}

			const durationMs = Date.now() - startedAtRef.current
			posthog?.capture('newsroom_article_read_completed', {
				slug: article.slug,
				duration_ms: durationMs,
				max_scroll_percent: maxScrollPercentRef.current,
				client_type: 'web'
			})
		}
	}, [article.slug, consent?.analytics, posthog])

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
		<div className="mx-auto flex w-full max-w-7xl gap-0 px-4 pt-22 pb-18">
			<main className="min-w-0 flex-1 lg:px-8">
				<Button variant="ghost" asChild className="mb-6 -ml-2">
					<Link to="/news-room" viewTransition>
						<ChevronLeft className="mr-1 h-4 w-4" />
						Back to Newsroom
					</Link>
				</Button>

				<header className="from-card/45 to-muted/10 mb-10 rounded-2xl border border-[var(--color-border)]/60 bg-gradient-to-br p-6 md:p-8">
					<div className="mb-5 flex flex-wrap items-center gap-2">
						<Badge variant="outline" className="capitalize">
							{article.category}
						</Badge>
						<Badge variant="outline">
							{article.readingTimeMinutes} min read
						</Badge>
						{article.draft ? (
							<Badge variant="secondary" className="uppercase">
								Draft
							</Badge>
						) : null}
					</div>

					<h1 className="mb-4 max-w-4xl text-4xl leading-[1.03] font-medium tracking-tight text-balance md:text-6xl">
						{article.title}
					</h1>
					<p className="text-muted-foreground max-w-3xl text-base leading-relaxed md:text-lg">
						{article.excerpt}
					</p>

					<div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-2 text-sm">
						<span>{formatNewsDate(article.publishedAt)}</span>
						{article.updatedAt ? (
							<>
								<span>•</span>
								<span>Updated {formatNewsDate(article.updatedAt)}</span>
							</>
						) : null}
					</div>

					<div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--color-border)]/50 pt-5">
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
							<p className="text-sm font-semibold tracking-tight">
								{article.author.name}
							</p>
							<p className="text-muted-foreground text-xs">
								{article.author.role}
							</p>
						</div>
						<div className="ml-auto flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={copyArticleLink}>
								<Copy className="mr-2 h-3.5 w-3.5" />
								{copied ? 'Copied' : 'Copy Link'}
							</Button>
						</div>
					</div>

					{article.author.bio && (
						<p className="text-muted-foreground mt-4 text-sm leading-relaxed md:text-base">
							{article.author.bio}
						</p>
					)}
				</header>

				<article
					ref={contentRef}
					className={cn(styles.docsContent, styles.newsroomContent, 'mb-10')}
				>
					<ArticleComponent />
				</article>

				<div className="border-border/60 mt-12 flex flex-col gap-6 border-t pt-6">
					<p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
						Continue Reading
					</p>
					<div className="grid gap-3 md:grid-cols-2">
						{adjacent.previous ? (
							<Button
								variant="ghost"
								asChild
								className="h-auto justify-start px-0 py-0"
							>
								<Link
									to={`/news-room/${adjacent.previous.slug}`}
									viewTransition
									className="border-border/70 bg-card/20 hover:border-border group rounded-xl border p-4"
								>
									<p className="text-muted-foreground mb-2 inline-flex items-center gap-2 text-xs tracking-wide uppercase">
										<ChevronLeft className="h-4 w-4" aria-hidden="true" />
										Previous Article
									</p>
									<p className="group-hover:text-foreground text-sm leading-snug font-semibold transition-colors">
										{adjacent.previous.title}
									</p>
								</Link>
							</Button>
						) : (
							<span />
						)}

						{adjacent.next ? (
							<Button
								variant="ghost"
								asChild
								className="h-auto justify-end px-0 py-0"
							>
								<Link
									to={`/news-room/${adjacent.next.slug}`}
									viewTransition
									className="border-border/70 bg-card/20 hover:border-border group rounded-xl border p-4 text-right"
								>
									<p className="text-muted-foreground mb-2 inline-flex items-center gap-2 text-xs tracking-wide uppercase">
										Next Article
										<ChevronRight className="h-4 w-4" aria-hidden="true" />
									</p>
									<p className="group-hover:text-foreground text-sm leading-snug font-semibold transition-colors">
										{adjacent.next.title}
									</p>
								</Link>
							</Button>
						) : (
							<span />
						)}
					</div>
				</div>

				{related.length > 0 && (
					<section className="mt-14">
						<h2 className="mb-5 text-xl font-semibold tracking-tight">
							More from the newsroom
						</h2>
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							{related.map((item) => (
								<Link
									key={item.slug}
									to={`/news-room/${item.slug}`}
									className="border-border/70 bg-card/15 hover:border-border block rounded-xl border p-5 transition-colors"
								>
									<p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
										{formatNewsDate(item.publishedAt)} •{' '}
										{item.readingTimeMinutes} min
									</p>
									<h3 className="mb-2 text-base leading-snug font-semibold">
										{item.title}
									</h3>
									<p className="text-muted-foreground line-clamp-3 text-sm">
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

export { PublicErrorBoundary as ErrorBoundary }
