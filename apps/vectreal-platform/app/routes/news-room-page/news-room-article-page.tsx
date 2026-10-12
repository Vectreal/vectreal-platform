import { usePostHog } from '@posthog/react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { ScrollArea } from '@shared/components/ui/scroll-area'
import { cn } from '@shared/utils'
import { ChevronLeft, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { data, Link } from 'react-router'

import { PageHandoffMenu } from '../../components/ai-handoff/ai-handoff-menu'
import { useConsent } from '../../components/consent/consent-context'
import { DocsPageToc } from '../../components/docs/docs-page-toc'
import { PublicErrorBoundary } from '../../components/errors'
import { AdjacentPager, AuthorCard } from '../../components/layout-components'
import { ArticleCard } from '../../components/layout-components/article-card'
import { ArticleCtaPanel } from '../../components/layout-components/article-cta-panel'
import { ArticleHero } from '../../components/layout-components/article-hero'
import { notFoundMeta, routeErrorMeta } from '../../components/not-found'
import { useConsentedCapture } from '../../hooks/use-consented-capture'
import { useDocToc } from '../../hooks/use-doc-toc'
import { markdownTwinLink } from '../../lib/markdown/markdown-twin'
import { getArticleBody } from '../../lib/news/news-article-body'
import {
	getAdjacentNewsArticles,
	getNewsArticle,
	getRelatedNewsArticles
} from '../../lib/news/news-manifest.server'
import { buildPageMeta, SITE_URL } from '../../lib/seo'
import {
	buildAuthorPersonJsonLd,
	buildBreadcrumbListJsonLd,
	buildNewsArticleJsonLd
} from '../../lib/seo-registry'
import styles from '../../styles/mdx.module.css'

import type { Route } from './+types/news-room-article-page'

export async function loader({ params }: Route.LoaderArgs) {
	const slug = params.slug ?? ''
	const article = getNewsArticle(slug)

	if (!article) {
		throw new Response('Article not found', { status: 404 })
	}

	return data({
		article,
		adjacent: getAdjacentNewsArticles(slug),
		related: getRelatedNewsArticles(slug, 3)
	})
}

export function meta({ error, loaderData }: Route.MetaArgs) {
	/*
	  A missing article renders the site 404, so it gets the 404's meta. It
	  used to stay indexable with a canonical pointing at `/news-room`, which
	  told search engines this URL was a copy of the listing.
	*/
	if (error) return routeErrorMeta(error)
	if (!loaderData) return notFoundMeta()

	const title = `${loaderData.article.title} - Vectreal Newsroom`
	const description = loaderData.article.excerpt
	const canonical = `/news-room/${loaderData.article.slug}`

	const twin = loaderData.article.draft ? [] : [markdownTwinLink(canonical)]

	return [
		...buildPageMeta(
			{
				title,
				description,
				canonical,
				type: 'article',
				image: loaderData.article.coverImage,
				imageAlt: loaderData.article.title,
				publishedTime: loaderData.article.publishedAt,
				modifiedTime:
					loaderData.article.updatedAt ?? loaderData.article.publishedAt,
				articleAuthor: loaderData.article.author.name,
				articleSection: loaderData.article.category,
				structuredData: [
					buildNewsArticleJsonLd({
						title: loaderData.article.title,
						description,
						canonicalPath: canonical,
						publishedAt: loaderData.article.publishedAt,
						updatedAt: loaderData.article.updatedAt,
						image: loaderData.article.coverImage,
						authorName: loaderData.article.author.name
					}),
					buildAuthorPersonJsonLd({
						name: loaderData.article.author.name,
						role: loaderData.article.author.role,
						linkedinUrl: loaderData.article.author.linkedinUrl
					}),
					buildBreadcrumbListJsonLd([
						{ name: 'Home', item: SITE_URL },
						{ name: 'Newsroom', item: `${SITE_URL}/news-room` },
						{ name: loaderData.article.title }
					])
				]
			},
			undefined,
			// Article cover images are 1200x630, so use the large card format.
			{
				twitterCard: loaderData.article.coverImage
					? 'summary_large_image'
					: undefined
			}
		),
		...twin
	]
}

/*
  One article, one instance. Following a related-article card navigates between
  two URLs of this route, so React Router keeps the page mounted and passes new
  loader data. Everything the page holds per article - the view sent once, the
  read clock, the furthest scroll, the milestones reached, the copied state -
  then carried over: the second article reported no view, a read measured from
  the first one's load, and none of its scroll milestones.
*/
export default function NewsRoomArticlePage({
	loaderData
}: Route.ComponentProps) {
	return (
		<NewsRoomArticle key={loaderData.article.slug} loaderData={loaderData} />
	)
}

function NewsRoomArticle({
	loaderData
}: Pick<Route.ComponentProps, 'loaderData'>) {
	const { article, adjacent, related } = loaderData
	const posthog = usePostHog()
	const { consent } = useConsent()
	const captureConsented = useConsentedCapture()
	const ArticleComponent = getArticleBody(article.sourcePath)
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

	// A draft has no markdown twin: the route list leaves drafts out.
	const handoff = article.draft
		? null
		: {
				surface: 'newsroom' as const,
				htmlPath: `/news-room/${article.slug}`,
				title: article.title
			}

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
			<div className="container-page max-w-4xl pt-32 pb-16 text-center">
				<h1 className="text-h3 mb-2">Article unavailable</h1>
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
		<div className="container-page flex justify-center gap-0 pt-16 pb-32 lg:gap-16">
			{/*
			  One live region for both copy buttons, which share `copied`. The label
			  swap inside a button is not announced unless the reader happens to be
			  on it, so the confirmation reached nobody using a screen reader.
			*/}
			<p aria-live="polite" className="sr-only">
				{copied ? 'Link copied to clipboard' : ''}
			</p>
			{/*
			  `max-w-measure` is the whole point of this column. `mdx.module.css`
			  says of `.docsContent` that it "fills the flex content column, no
			  max-width", which on a wide screen ran a line of body copy past
			  1200px - roughly 140 characters, about twice the distance an eye
			  reliably returns from.

			  `self-start`, so it is not stretched to the row. A stretched flex item
			  has a definite height, the whole article's, and every `h-full` inside
			  it resolved to that: first the hero, 12,326px tall with its image
			  over the entire page, then the closing call to action. Each was
			  patched by taking its `h-full` away; this is the cause.
			*/}
			<main className="max-w-measure w-full min-w-0 self-start">
				<Button variant="ghost" asChild className="mb-6 -ml-2">
					<Link to="/news-room" viewTransition>
						<ChevronLeft className="mr-1 h-4 w-4" />
						Back to Newsroom
					</Link>
				</Button>

				{article.draft ? (
					<Badge variant="secondary" className="mt-4 mb-6 uppercase">
						Draft
					</Badge>
				) : null}

				<ArticleHero
					slug={article.slug}
					title={article.title}
					category={article.category}
					publishedAt={article.publishedAt}
					{...(article.updatedAt ? { updatedAt: article.updatedAt } : {})}
					{...(article.sceneImage ? { sceneImage: article.sceneImage } : {})}
					{...(article.heroImage ? { heroImage: article.heroImage } : {})}
				/>

				<p className="text-muted-foreground text-body-lg mt-6">
					{article.excerpt}
				</p>

				{/*
				  Author, reading time and the share control live in the rail on
				  large screens, where they stay reachable for the whole article
				  instead of scrolling away in the first screenful. Below `lg`
				  there is no rail, so they appear here instead - the same
				  components, rendered once, in whichever place exists.
				*/}
				<div className="mt-16 flex flex-wrap items-center gap-3 lg:hidden">
					<AuthorCard author={article.author} />
					<span className="text-muted-foreground text-body-sm">
						{article.readingTimeMinutes} min read
					</span>
					<Button
						variant="secondary"
						size="sm"
						className="ml-auto"
						onClick={copyArticleLink}
					>
						<Copy className="mr-2 h-3.5 w-3.5" />
						{copied ? 'Copied' : 'Copy link'}
					</Button>
					{handoff ? (
						<PageHandoffMenu {...handoff} className="basis-full justify-end" />
					) : null}
				</div>

				{/*
				  The article owns the gap above it. It used to borrow it from the
				  metadata row's bottom margin, so on `lg`, where that row is hidden,
				  the body ran straight on from the standfirst.
				*/}
				<article
					ref={contentRef}
					className={cn(styles.docsContent, styles.newsroomContent, 'my-16')}
				>
					<ArticleComponent />
				</article>

				<ArticleCtaPanel
					cta={article.cta}
					onAction={(action) =>
						captureConsented('newsroom_cta_clicked', {
							slug: article.slug,
							destination: article.cta.kind,
							action
						})
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
							? {
									to: `/news-room/${adjacent.next.slug}`,
									title: adjacent.next.title
								}
							: null
					}
				/>

				{related.length > 0 && (
					<section className="mt-32">
						<h2 className="text-h3 mb-8">More from the newsroom</h2>
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							{related.map((item) => (
								<ArticleCard key={item.slug} article={item} />
							))}
						</div>
					</section>
				)}
			</main>

			{/*
			  The rail. It used to hold only a table of contents and only above
			  `xl`, which meant most desktop readers got a 256px empty gutter and
			  the article's own metadata scrolled away after the first screenful.

			  It now carries what a reader actually reaches for mid-article -
			  who wrote this, how long it runs, a link to copy - with the
			  contents below it. `dvh`, not `vh`: `100vh` is the large viewport
			  and overhangs persistent browser chrome.
			*/}
			<aside
				className="sticky top-20 hidden h-[calc(100dvh-5rem)] w-64 shrink-0 lg:block"
				aria-label="About this article"
			>
				<div className="flex h-full flex-col gap-6 pl-6">
					<div className="space-y-3">
						<AuthorCard author={article.author} />
						<p className="text-muted-foreground text-body-sm">
							{article.readingTimeMinutes} min read
						</p>
						<Button
							variant="secondary"
							size="sm"
							className="w-full"
							onClick={copyArticleLink}
						>
							<Copy className="mr-2 h-3.5 w-3.5" />
							{copied ? 'Copied' : 'Copy link'}
						</Button>
						{handoff ? <PageHandoffMenu {...handoff} /> : null}
					</div>

					{headings.length > 0 && (
						<div className="flex min-h-0 flex-1 flex-col pt-4">
							<p className="text-muted-foreground text-eyebrow mb-3 shrink-0">
								On this page
							</p>
							{/*
							  `flex-1 min-h-0` rather than `h-full`: `h-full` is 100% of
							  the container, which already spends ~23px on the heading
							  above, so the scroll viewport overhung the bottom of the
							  sticky aside by exactly that much.
							*/}
							<ScrollArea className="min-h-0 flex-1 pr-2 pb-8">
								<DocsPageToc headings={headings} activeId={activeId} />
							</ScrollArea>
						</div>
					)}
				</div>
			</aside>
		</div>
	)
}

export { PublicErrorBoundary as ErrorBoundary }
