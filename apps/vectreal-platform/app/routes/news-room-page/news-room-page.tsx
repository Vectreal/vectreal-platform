import { usePostHog } from '@posthog/react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { ArrowRight, Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { data, Form, Link } from 'react-router'

import { useConsent } from '../../components/consent/consent-context'
import {
	ArticleCard,
	CtaPanel,
	PageHero
} from '../../components/layout-components'
import {
	getNewsArticles,
	getNewsCategories,
	getNewsTags
} from '../../lib/news/news-manifest'
import { buildPageMeta, SITE_URL } from '../../lib/seo'
import {
	buildCollectionPageJsonLd,
	PUBLIC_SEO_PAGES
} from '../../lib/seo-registry'

import type { Route } from './+types/news-room-page'

type SortMode = 'newest' | 'oldest'

interface NewsRoomFilters {
	query: string
	category: string
	tag: string
	sort: SortMode
}

function parseSortMode(value: string | null): SortMode {
	return value === 'oldest' ? 'oldest' : 'newest'
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

	if (nextFilters.tag) {
		params.set('tag', nextFilters.tag)
	}

	if (nextFilters.sort !== 'newest') {
		params.set('sort', nextFilters.sort)
	}

	const queryString = params.toString()
	return queryString ? `/news-room?${queryString}` : '/news-room'
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const query = url.searchParams.get('q')?.trim() ?? ''
	const category = url.searchParams.get('category')?.trim() ?? ''
	const tag = url.searchParams.get('tag')?.trim() ?? ''
	const sort = parseSortMode(url.searchParams.get('sort'))

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

	if (tag) {
		articles = articles.filter((article) => article.tags.includes(tag))
	}

	articles.sort((a, b) => {
		const timeA = Date.parse(a.publishedAt)
		const timeB = Date.parse(b.publishedAt)
		if (sort === 'oldest') {
			return timeA - timeB
		}

		return timeB - timeA
	})

	return data({
		articles,
		categories: getNewsCategories(),
		tags: getNewsTags(),
		filters: {
			query,
			category,
			tag,
			sort
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
	const { articles, categories, tags, filters } = loaderData
	const posthog = usePostHog()
	const { consent } = useConsent()
	const viewTrackedRef = useRef(false)
	const [featuredArticle, ...remainingArticles] = articles
	const hasAdvancedFilters =
		Boolean(filters.category) ||
		Boolean(filters.tag) ||
		filters.sort === 'oldest'
	const hasAnyFilters = Boolean(filters.query) || hasAdvancedFilters
	const featuredTopics = categories.slice(0, 4)
	const featuredTags = tags.slice(0, 3)
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
			has_category_filter: Boolean(filters.category),
			has_tag_filter: Boolean(filters.tag),
			sort_mode: filters.sort
		})
	}, [
		articles.length,
		consent?.analytics,
		filters.category,
		filters.query,
		filters.sort,
		filters.tag,
		posthog
	])

	return (
		<div>
			<PageHero
				eyebrow="Newsroom"
				heading="Learn about what's new and what's next at Vectreal."
				description="Launches, engineering notes, and product decisions. Cleanly published from MDX."
				actions={
					<>
						<Button asChild size="sm">
							<Link to="/sign-up">
								Start free
								<ArrowRight className="h-3.5 w-3.5" />
							</Link>
						</Button>
						<Button variant="secondary" size="sm" asChild>
							<Link to={latestStoryPath} viewTransition>
								Read latest
							</Link>
						</Button>
						<Badge variant="secondary">
							{articles.length} published stories
						</Badge>
					</>
				}
			/>

			<div className="container-page pb-20">
				<section className="mb-8 flex flex-wrap items-center gap-2 md:mb-10">
					<Form method="get" className="flex items-center gap-2">
						<input type="hidden" name="category" value={filters.category} />
						<input type="hidden" name="tag" value={filters.tag} />
						<input type="hidden" name="sort" value={filters.sort} />
						<label className="ds-sunken focus-within:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 transition-shadow focus-within:ring-2">
							<Search className="text-muted-foreground h-3.5 w-3.5" />
							<input
								type="search"
								name="q"
								defaultValue={filters.query}
								placeholder="Search"
								aria-label="Search newsroom posts"
								className="placeholder:text-muted-foreground h-6 w-22 bg-transparent text-xs transition-all duration-300 outline-none focus:w-44 md:w-28 md:focus:w-52"
							/>
						</label>
						<Button type="submit" variant="ghost" size="sm">
							Search
						</Button>
					</Form>

					<Button
						variant={
							!filters.category && !filters.tag && filters.sort === 'newest'
								? 'secondary'
								: 'ghost'
						}
						size="sm"
						asChild
					>
						<Link
							to={buildNewsRoomPath(filters, {
								category: '',
								tag: '',
								sort: 'newest'
							})}
						>
							All
						</Link>
					</Button>

					{featuredTopics.map((topic) => (
						<Button
							key={topic}
							variant={filters.category === topic ? 'secondary' : 'ghost'}
							size="sm"
							asChild
						>
							<Link
								to={buildNewsRoomPath(filters, {
									category: topic,
									tag: '',
									sort: 'newest'
								})}
							>
								{topic}
							</Link>
						</Button>
					))}

					{featuredTags.map((tag) => (
						<Button
							key={tag}
							variant={filters.tag === tag ? 'secondary' : 'ghost'}
							size="sm"
							asChild
						>
							<Link
								to={buildNewsRoomPath(filters, {
									tag,
									category: '',
									sort: 'newest'
								})}
							>
								#{tag}
							</Link>
						</Button>
					))}

					<Button
						variant={filters.sort === 'oldest' ? 'secondary' : 'ghost'}
						size="sm"
						asChild
					>
						<Link
							to={buildNewsRoomPath(filters, {
								sort: filters.sort === 'oldest' ? 'newest' : 'oldest'
							})}
						>
							{filters.sort === 'oldest' ? 'Oldest first' : 'Newest first'}
						</Link>
					</Button>

					{hasAnyFilters ? (
						<Badge
							variant="secondary"
							asChild
							className="h-8 rounded-full px-3"
						>
							<Link to="/news-room" className="inline-flex items-center gap-1">
								Reset
								<X className="h-3 w-3" aria-hidden="true" />
							</Link>
						</Badge>
					) : null}
				</section>

				<section id="news-feed" className="scroll-mt-24 space-y-4">
					{articles.length === 0 ? (
						<div className="ds-raised rounded-2xl p-8 text-center md:p-10">
							<h2 className="mb-1 text-lg font-semibold">No matching posts</h2>
							<p className="text-muted-foreground text-sm">
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
								<ArticleCard article={featuredArticle} variant="featured" />
							) : null}

							{remainingArticles.length > 0 ? (
								<div className="grid gap-4 md:grid-cols-2">
									{remainingArticles.map((article) => (
										<ArticleCard key={article.slug} article={article} />
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
