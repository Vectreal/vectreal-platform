import { usePostHog } from '@posthog/react'
import { Button } from '@shared/components/ui/button'
import { ArrowRight, Search } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { data, Form, Link } from 'react-router'

import { useConsent } from '../../components/consent/consent-context'
import {
	ArticleRow,
	CtaPanel,
	FeaturedArticle,
	PageHero
} from '../../components/layout-components'
import {
	getNewsArticles,
	getNewsCategories
} from '../../lib/news/news-manifest'
import { buildPageMeta, SITE_URL } from '../../lib/seo'
import {
	buildCollectionPageJsonLd,
	PUBLIC_SEO_PAGES
} from '../../lib/seo-registry'

import type { Route } from './+types/news-room-page'

interface NewsRoomFilters {
	query: string
	category: string
}

function includesCaseInsensitive(value: string, search: string): boolean {
	return value.toLowerCase().includes(search.toLowerCase())
}

function buildNewsRoomPath(
	filters: NewsRoomFilters,
	overrides: Partial<NewsRoomFilters> = {}
): string {
	const nextFilters = { ...filters, ...overrides }
	const params = new URLSearchParams()

	if (nextFilters.query) {
		params.set('q', nextFilters.query)
	}

	if (nextFilters.category) {
		params.set('category', nextFilters.category)
	}

	const queryString = params.toString()
	return queryString ? `/news-room?${queryString}` : '/news-room'
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const query = url.searchParams.get('q')?.trim() ?? ''
	const category = url.searchParams.get('category')?.trim() ?? ''

	let articles = getNewsArticles().map(
		({ Component: _, ...article }) => article
	)

	if (query) {
		articles = articles.filter((article) => {
			const searchableText = [
				article.title,
				article.excerpt,
				article.category,
				article.author.name,
				...article.tags
			].join(' ')

			return includesCaseInsensitive(searchableText, query)
		})
	}

	if (category) {
		articles = articles.filter((article) => article.category === category)
	}

	articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))

	return data({
		articles,
		/*
		  The unfiltered total. `articles` above is already narrowed by query,
		  category and tag, so a hero reading `${articles.length} articles` said
		  "1 articles" on a single match and "0 articles" directly above the
		  empty state.
		*/
		totalArticles: getNewsArticles().length,
		categories: getNewsCategories(),
		filters: {
			query,
			category
		}
	})
}

export function meta(_: Route.MetaArgs) {
	return buildPageMeta({
		...PUBLIC_SEO_PAGES.newsroom,
		structuredData: buildCollectionPageJsonLd({
			name: 'Vectreal News Room',
			url: `${SITE_URL}/news-room`,
			description: PUBLIC_SEO_PAGES.newsroom.description
		})
	})
}

export default function NewsRoomPage({ loaderData }: Route.ComponentProps) {
	const { articles, totalArticles, categories, filters } = loaderData
	const posthog = usePostHog()
	const { consent } = useConsent()
	const viewTrackedRef = useRef(false)
	const [featuredArticle, ...remainingArticles] = articles
	const latestStoryPath = featuredArticle
		? `/news-room/${featuredArticle.slug}`
		: '/news-room#news-feed'

	useEffect(() => {
		if (!consent?.analytics || viewTrackedRef.current) {
			return
		}

		viewTrackedRef.current = true
		posthog?.capture('newsroom_listing_viewed', {
			result_count: articles.length,
			has_query: Boolean(filters.query),
			has_category_filter: Boolean(filters.category)
		})
	}, [
		articles.length,
		consent?.analytics,
		filters.category,
		filters.query,
		posthog
	])

	return (
		<div>
			<PageHero
				heading="Launches, engineering notes, and the decisions behind them."
				description={`${totalArticles} articles on building, optimizing and publishing 3D for the web.`}
				actions={
					<>
						<Button asChild size="sm">
							<Link to={latestStoryPath} viewTransition>
								Read the latest
								<ArrowRight className="h-3.5 w-3.5" />
							</Link>
						</Button>
						<Button variant="ghost" size="sm" asChild>
							<Link to="/sign-up">Start free</Link>
						</Button>
					</>
				}
			/>

			<div className="container-page pb-20">
				{/*
				  One axis, not three.

				  This row held fifteen controls in three visual treatments: a search
				  field, "All", four topics, three tags, a sort toggle and a reset
				  badge, all wrapping together. Topics and tags rendered identically
				  while filtering different things, so the row looked like one flat
				  list of nine equivalent buttons and was none.

				  Tags and sort are gone rather than restyled. Neither was reachable
				  from anywhere else - no article links a tag - so they were a second
				  and third axis on a twelve-article index, competing with the one
				  people actually use.
				*/}
				<section
					aria-label="Filter articles"
					className="mb-8 flex flex-wrap items-center justify-between gap-4 md:mb-10"
				>
					<div className="flex flex-wrap items-center gap-1">
						<Button
							variant={filters.category ? 'ghost' : 'secondary'}
							size="sm"
							asChild
						>
							<Link to={buildNewsRoomPath(filters, { category: '' })}>All</Link>
						</Button>
						{categories.map((topic) => (
							<Button
								key={topic}
								variant={filters.category === topic ? 'secondary' : 'ghost'}
								size="sm"
								asChild
							>
								<Link
									to={buildNewsRoomPath(filters, { category: topic })}
									aria-current={filters.category === topic ? 'true' : undefined}
								>
									{topic}
								</Link>
							</Button>
						))}
					</div>

					<Form method="get" className="flex items-center gap-2">
						<input type="hidden" name="category" value={filters.category} />
						<label className="ds-sunken inline-flex h-9 items-center gap-2 rounded-full px-3">
							<Search className="text-muted-foreground h-4 w-4 shrink-0" />
							<input
								type="search"
								name="q"
								defaultValue={filters.query}
								placeholder="Search articles"
								aria-label="Search newsroom articles"
								className="text-body-sm placeholder:text-muted-foreground w-40 bg-transparent md:w-48"
							/>
						</label>
						<Button type="submit" variant="ghost" size="sm">
							Search
						</Button>
					</Form>
				</section>

				<section id="news-feed" className="scroll-mt-24 space-y-4">
					{articles.length === 0 ? (
						<div className="ds-raised rounded-2xl p-8 text-center md:p-10">
							<h2 className="text-h3 font-heading mb-1">No matching posts</h2>
							<p className="text-muted-foreground text-body-sm">
								Try another topic or clear your filters.
							</p>
							<div className="mt-4 flex flex-wrap items-center justify-center gap-2">
								<Button size="sm" asChild>
									<Link to="/news-room">Show latest</Link>
								</Button>
								<Button variant="ghost" size="sm" asChild>
									<Link to="/sign-up">Create free account</Link>
								</Button>
							</div>
						</div>
					) : (
						<>
							{featuredArticle ? (
								<FeaturedArticle article={featuredArticle} />
							) : null}

							{remainingArticles.length > 0 ? (
								<div className="border-border mt-10 border-t">
									{remainingArticles.map((article) => (
										<ArticleRow key={article.slug} article={article} />
									))}
								</div>
							) : null}

							<CtaPanel
								className="mt-32"
								eyebrow="Build while you're learning"
								heading="Turn ideas from these articles into live 3D experiences."
								description="Create a free account to publish your first scene and keep shipping faster with Vectreal."
								actions={
									<>
										<Button asChild>
											<Link to="/sign-up">
												Start free
												<ArrowRight className="h-4 w-4" />
											</Link>
										</Button>
										<Button variant="ghost" asChild>
											<Link to="/pricing">Compare plans</Link>
										</Button>
									</>
								}
							/>
						</>
					)}
				</section>
			</div>
		</div>
	)
}
