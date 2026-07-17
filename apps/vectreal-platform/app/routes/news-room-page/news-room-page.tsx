import { usePostHog } from '@posthog/react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { ArrowRight, Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { data, Form, Link } from 'react-router'

import { useConsent } from '../../components/consent/consent-context'
import { BasicCard, PageHero } from '../../components/layout-components'
import {
	formatNewsDate,
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

			<div className="mx-auto w-full max-w-7xl px-4 pb-20 md:px-6">
				<section className="mb-8 flex flex-wrap items-center gap-2 md:mb-10">
					<Form method="get" className="flex items-center gap-2">
						<input type="hidden" name="category" value={filters.category} />
						<input type="hidden" name="tag" value={filters.tag} />
						<input type="hidden" name="sort" value={filters.sort} />
						<label className="border-border/70 bg-card/20 focus-within:border-border inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 transition-all duration-200">
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
						<div className="border-border/50 bg-muted/10 rounded-2xl border p-8 text-center md:p-10">
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
								<Link
									to={`/news-room/${featuredArticle.slug}`}
									viewTransition
									className="group block"
								>
									<BasicCard
										as="article"
										highlight
										cardClassName="overflow-hidden py-0"
									>
										{featuredArticle.thumbnailImage ? (
											<div className="h-20 overflow-hidden md:hidden">
												<img
													src={featuredArticle.thumbnailImage}
													alt=""
													width={1200}
													height={160}
													fetchPriority="high"
													className="h-full w-full object-cover object-center"
												/>
											</div>
										) : null}

										<div className="grid md:grid-cols-[1fr_280px]">
											<div className="flex flex-col justify-between p-6 md:p-9">
												<div>
													<div className="mb-5 flex flex-wrap items-center gap-2.5">
														<span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-[11px] font-semibold tracking-[0.12em] uppercase">
															Featured
														</span>
														<span className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
															{featuredArticle.category}
														</span>
														<span className="text-border">·</span>
														<span className="text-muted-foreground text-[11px]">
															{formatNewsDate(featuredArticle.publishedAt)}
														</span>
														<span className="text-border">·</span>
														<span className="text-muted-foreground text-[11px]">
															{featuredArticle.readingTimeMinutes} min read
														</span>
													</div>

													<h2 className="group-hover:text-foreground/85 mb-4 text-3xl leading-[1.06] font-semibold tracking-tight text-balance transition-colors md:text-5xl">
														{featuredArticle.title}
													</h2>
													<p className="text-muted-foreground line-clamp-3 max-w-xl text-base leading-relaxed md:text-lg">
														{featuredArticle.excerpt}
													</p>
												</div>

												<footer className="border-border/40 mt-7 flex flex-wrap items-center gap-3 border-t pt-5">
													<div>
														<p className="text-sm leading-tight font-semibold">
															{featuredArticle.author.name}
														</p>
														<p className="text-muted-foreground text-xs">
															{featuredArticle.author.role}
														</p>
													</div>
												</footer>
											</div>

											{featuredArticle.thumbnailImage ? (
												<div className="border-border/40 relative hidden overflow-hidden border-l md:block">
													<img
														src={featuredArticle.thumbnailImage}
														alt=""
														width={280}
														height={520}
														fetchPriority="high"
														className="h-full w-full object-cover object-center"
													/>
												</div>
											) : null}
										</div>
									</BasicCard>
								</Link>
							) : null}

							{remainingArticles.length > 0 ? (
								<div className="grid gap-4 md:grid-cols-2">
									{remainingArticles.map((article) => (
										<Link
											key={article.slug}
											to={`/news-room/${article.slug}`}
											viewTransition
											className="group block"
										>
											<BasicCard
												highlight
												cardClassName="grid grid-cols-[1fr_auto] overflow-hidden py-0"
											>
												<div className="flex flex-col justify-between p-5 md:p-6">
													<div>
														<div className="mb-3 flex flex-wrap items-center gap-1.5">
															<span className="text-primary text-[11px] font-semibold tracking-[0.12em] uppercase">
																{article.category}
															</span>
															<span className="text-border text-[11px]">·</span>
															<span className="text-muted-foreground text-[11px]">
																{formatNewsDate(article.publishedAt)}
															</span>
															<span className="text-border text-[11px]">·</span>
															<span className="text-muted-foreground text-[11px]">
																{article.readingTimeMinutes} min
															</span>
														</div>

														<h3 className="group-hover:text-foreground/85 mb-2.5 text-xl leading-snug font-semibold tracking-tight text-balance transition-colors md:text-2xl">
															{article.title}
														</h3>
														<p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed md:text-base">
															{article.excerpt}
														</p>
													</div>

													<footer className="border-border/40 mt-5 flex items-center gap-1.5 border-t pt-4">
														<span className="text-foreground text-xs font-semibold">
															{article.author.name}
														</span>
														<span className="text-muted-foreground text-xs">
															{article.author.role}
														</span>
													</footer>
												</div>

												{article.thumbnailImage ? (
													<div className="border-border/40 relative w-14 overflow-hidden border-l md:w-24">
														<img
															src={article.thumbnailImage}
															alt=""
															width={112}
															height={300}
															className="h-full w-full object-cover object-center"
														/>
													</div>
												) : null}
											</BasicCard>
										</Link>
									))}
								</div>
							) : null}

							<BasicCard
								as="section"
								cardClassName="p-6 md:p-8 "
								className="mt-32"
							>
								<p className="text-primary text-xs font-semibold tracking-wider uppercase">
									Build while you're learning
								</p>
								<h2 className="max-w-2xl text-2xl leading-tight font-semibold tracking-tight md:text-3xl">
									Turn ideas from these articles into live 3D experiences.
								</h2>
								<p className="text-muted-foreground max-w-2xl text-sm leading-relaxed md:text-base">
									Create a free account to publish your first scene and keep
									shipping faster with Vectreal.
								</p>
								<div className="flex flex-wrap items-center gap-2">
									<Button asChild>
										<Link to="/sign-up">
											Start free
											<ArrowRight className="h-4 w-4" />
										</Link>
									</Button>
									<Button variant="ghost" asChild>
										<Link to="/pricing">Compare plans</Link>
									</Button>
								</div>
							</BasicCard>
						</>
					)}
				</section>
			</div>
		</div>
	)
}
