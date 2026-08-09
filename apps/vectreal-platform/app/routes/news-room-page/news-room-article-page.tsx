import { usePostHog } from '@posthog/react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger
} from '@shared/components/ui/hover-card'
import { ScrollArea } from '@shared/components/ui/scroll-area'
import { cn } from '@shared/utils'
import { ArrowRight, ChevronLeft, Copy } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { data, Link } from 'react-router'

import { useConsent } from '../../components/consent/consent-context'
import { DocsPageToc } from '../../components/docs/docs-page-toc'
import { PublicErrorBoundary } from '../../components/errors'
import {
	AdjacentPager,
	ArticleCard,
	ArticleHero,
	AuthorChip,
	CtaPanel
} from '../../components/layout-components'
import { useDocToc } from '../../hooks/use-doc-toc'
import {
	getAdjacentNewsArticles,
	getNewsArticle,
	getRelatedNewsArticles
} from '../../lib/news/news-manifest'
import { buildPageMeta, SITE_URL } from '../../lib/seo'
import {
	buildAuthorPersonJsonLd,
	buildBreadcrumbListJsonLd,
	buildNewsArticleJsonLd
} from '../../lib/seo-registry'
import styles from '../../styles/mdx.module.css'

import type { Route } from './+types/news-room-article-page'


function githubHandle(url: string | undefined): string | null {
	if (!url) {
		return null
	}

	const match = url.match(/github\.com\/([^/?#]+)/i)
	if (!match?.[1]) {
		return null
	}

	return `@${match[1]}`
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

	return buildPageMeta(
		{
			title,
			description,
			canonical,
			type: 'article',
			image: data.article.coverImage,
			imageAlt: data.article.title,
			publishedTime: data.article.publishedAt,
			modifiedTime: data.article.updatedAt ?? data.article.publishedAt,
			articleAuthor: data.article.author.name,
			articleSection: data.article.category,
			structuredData: [
				buildNewsArticleJsonLd({
					title: data.article.title,
					description,
					canonicalPath: canonical,
					publishedAt: data.article.publishedAt,
					updatedAt: data.article.updatedAt,
					image: data.article.coverImage,
					authorName: data.article.author.name,
					authorRole: data.article.author.role,
					authorXUrl: data.article.author.xUrl,
					authorLinkedinUrl: data.article.author.linkedinUrl
				}),
				buildAuthorPersonJsonLd({
					name: data.article.author.name,
					role: data.article.author.role,
					xUrl: data.article.author.xUrl,
					linkedinUrl: data.article.author.linkedinUrl
				}),
				buildBreadcrumbListJsonLd([
					{ name: 'Home', item: SITE_URL },
					{ name: 'News Room', item: `${SITE_URL}/news-room` },
					{ name: data.article.title }
				])
			]
		},
		undefined,
		// Article cover images are 1200x630, so use the large card format.
		{ twitterCard: data.article.coverImage ? 'summary_large_image' : undefined }
	)
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
	const authorGithubHandle = githubHandle(article.author.xUrl)

	useEffect(() => {
		if (!consent?.analytics || viewTrackedRef.current) {
			return
		}

		viewTrackedRef.current = true
		posthog?.capture('newsroom_article_viewed', {
			slug: article.slug,
			category: article.category,
			reading_time_minutes: article.readingTimeMinutes
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
						milestone_percent: milestone
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
				max_scroll_percent: maxScrollPercentRef.current
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
			<div className="container-page max-w-4xl pt-28 pb-20 text-center">
				<h1 className="mb-2 text-2xl font-medium">Article unavailable</h1>
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
		<div className="container-page flex gap-0 py-16">
			<main className="min-w-0 flex-1 lg:px-8">
				<Button variant="ghost" asChild className="mb-6 -ml-2">
					<Link to="/news-room" viewTransition>
						<ChevronLeft className="mr-1 h-4 w-4" />
						Back to Newsroom
					</Link>
				</Button>

				<div className="mt-4 mb-6 -ml-1 flex flex-wrap items-center justify-between gap-2 px-2 md:mt-16">
					<div className="flex items-center gap-2">
						<Badge variant="secondary">
							{article.readingTimeMinutes} min read
						</Badge>
						{article.draft ? (
							<Badge variant="secondary" className="uppercase">
								Draft
							</Badge>
						) : null}
					</div>
				</div>

				<ArticleHero
					slug={article.slug}
					title={article.title}
					category={article.category}
					publishedAt={article.publishedAt}
					{...(article.updatedAt ? { updatedAt: article.updatedAt } : {})}
					{...(article.sceneImage ? { sceneImage: article.sceneImage } : {})}
					{...(article.heroImage ? { heroImage: article.heroImage } : {})}
				/>

				<p className="text-muted-foreground text-body-lg mt-6 max-w-3xl px-2 leading-relaxed">
					{article.excerpt}
				</p>

				<div className="mb-8 flex flex-wrap items-center gap-3 pt-4 md:mb-16">
					<HoverCard openDelay={130} closeDelay={120}>
						<HoverCardTrigger asChild>
							<Button variant="ghost" className="h-[unset] gap-2 text-left">
								<AuthorChip author={article.author} />
							</Button>
						</HoverCardTrigger>
						<HoverCardContent
							align="start"
							sideOffset={10}
							className="w-80 p-4"
						>
							<div className="flex flex-col gap-3">
								<AuthorChip author={article.author} />
								<div className="min-w-0 flex-1">
									<p className="text-muted-foreground text-xs leading-relaxed">
										{article.author.bio ?? 'Author at Vectreal.'}
									</p>
									{article.author.xUrl ? (
										<a
											href={article.author.xUrl}
											target="_blank"
											rel="noreferrer"
											className="text-orange mt-2 inline-block text-xs font-medium hover:underline"
										>
											{authorGithubHandle ?? 'GitHub Profile'}
										</a>
									) : null}
								</div>
							</div>
						</HoverCardContent>
					</HoverCard>
					<div className="ml-auto flex items-center gap-2">
						<Button variant="secondary" size="sm" onClick={copyArticleLink}>
							<Copy className="mr-2 h-3.5 w-3.5" />
							{copied ? 'Copied' : 'Copy Link'}
						</Button>
					</div>
				</div>

				<article
					ref={contentRef}
					className={cn(
						styles.docsContent,
						styles.newsroomContent,
						'mb-16 px-2'
					)}
				>
					<ArticleComponent />
				</article>

				<CtaPanel
					eyebrow="Built for makers shipping in 3D"
					heading="Ready to publish your first interactive scene?"
					aside={
						<>
							<Badge variant="secondary">No credit card required</Badge>
							<Badge variant="secondary">Free plan available</Badge>
							<Badge variant="secondary">Embed in minutes</Badge>
						</>
					}
					actions={
						<>
							<Button asChild>
								<Link to="/sign-up">
									Create free account
									<ArrowRight className="h-4 w-4" />
								</Link>
							</Button>
							<Button variant="ghost" asChild>
								<Link to="/pricing">See plans</Link>
							</Button>
						</>
					}
				/>

				<AdjacentPager
					className="mt-12"
					label="Continue reading"
					previous={
						adjacent.previous
							? {
									to: `/news-room/${adjacent.previous.slug}`,
									title: adjacent.previous.title
								}
							: null
					}
					next={
						adjacent.next
							? { to: `/news-room/${adjacent.next.slug}`, title: adjacent.next.title }
							: null
					}
				/>

				{related.length > 0 && (
					<section className="mt-32">
						<h2 className="text-h3 mb-6! ml-2">
							More from the newsroom
						</h2>
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							{related.map((item) => (
								<ArticleCard key={item.slug} article={item} />
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
					<p className="text-muted-foreground mb-3 px-1 text-xs font-medium tracking-wider uppercase">
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
