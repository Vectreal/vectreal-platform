import { usePostHog } from '@posthog/react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { data, Form, Link } from 'react-router'

import { useConsent } from '../../components/consent/consent-context'
import {
	formatNewsDate,
	getNewsArticles,
	getNewsCategories,
	getNewsTags
} from '../../lib/news/news-manifest'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'

import type { Route } from './+types/news-room-page'

type SortMode = 'newest' | 'oldest'

function parseSortMode(value: string | null): SortMode {
	return value === 'oldest' ? 'oldest' : 'newest'
}

function includesCaseInsensitive(value: string, search: string): boolean {
	return value.toLowerCase().includes(search.toLowerCase())
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
	return buildPageMeta(PUBLIC_SEO_PAGES.newsroom)
}

export default function NewsRoomPage({ loaderData }: Route.ComponentProps) {
	const { articles, categories, tags, filters } = loaderData
	const posthog = usePostHog()
	const { consent } = useConsent()
	const viewTrackedRef = useRef(false)
	const [featuredArticle, ...remainingArticles] = articles

	useEffect(() => {
		if (!consent?.analytics || viewTrackedRef.current) {
			return
		}

		viewTrackedRef.current = true
		posthog?.capture('newsroom_listing_viewed', {
			client_type: 'web',
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
		<div className="mx-auto w-full max-w-6xl px-5 pt-24 pb-20 md:px-8">
			<header className="mb-12 space-y-4">
				<p className="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
					Newsroom
				</p>
				<h1 className="max-w-4xl text-4xl leading-[1.02] font-medium tracking-tight text-balance md:text-6xl">
					Learn about what's new and what's next at Vectreal.
				</h1>
				<p className="text-muted-foreground max-w-3xl text-base leading-relaxed md:text-lg">
					Launches, engineering notes, and product decisions. Cleanly published
					from MDX.
				</p>
				<div className="flex flex-wrap gap-2 pt-2 text-xs">
					<Badge variant="outline">{articles.length} Articles</Badge>
					<Badge variant="outline">Product & Engineering</Badge>
					<Badge variant="outline">Weekly Updates</Badge>
				</div>
			</header>

			<section className="border-border/60 bg-muted/15 mb-12 rounded-2xl border p-4 md:p-6">
				<div className="mb-4 flex items-center justify-between gap-3">
					<h2 className="text-base font-semibold tracking-tight">
						Filter & Search
					</h2>
					<p className="text-muted-foreground text-xs">URL-synced controls</p>
				</div>
				<Form method="get" className="grid gap-3 md:grid-cols-5">
					<label className="relative block md:col-span-2">
						<Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
						<input
							type="search"
							name="q"
							defaultValue={filters.query}
							placeholder="Search posts…"
							aria-label="Search newsroom posts"
							className="border-input bg-background/60 placeholder:text-muted-foreground focus-visible:ring-ring h-10 w-full rounded-md border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
						/>
					</label>

					<select
						name="category"
						defaultValue={filters.category}
						aria-label="Filter by category"
						className="border-input bg-background/60 h-10 rounded-md border px-3 text-sm"
					>
						<option value="">All categories</option>
						{categories.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>

					<select
						name="tag"
						defaultValue={filters.tag}
						aria-label="Filter by tag"
						className="border-input bg-background/60 h-10 rounded-md border px-3 text-sm"
					>
						<option value="">All tags</option>
						{tags.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>

					<select
						name="sort"
						defaultValue={filters.sort}
						aria-label="Sort articles"
						className="border-input bg-background/60 h-10 rounded-md border px-3 text-sm"
					>
						<option value="newest">Newest first</option>
						<option value="oldest">Oldest first</option>
					</select>

					<div className="flex items-center gap-2 md:col-span-5">
						<Button type="submit">Apply Filters</Button>
						<Button variant="ghost" asChild>
							<Link to="/news-room">Reset</Link>
						</Button>
					</div>
				</Form>
			</section>

			<section className="space-y-6">
				{articles.length === 0 ? (
					<div className="border-border/50 bg-muted/10 rounded-2xl border p-10 text-center">
						<h2 className="mb-1 text-lg font-semibold">No matching posts</h2>
						<p className="text-muted-foreground text-sm">
							Try another filter or clear search.
						</p>
					</div>
				) : (
					<>
						{featuredArticle ? (
							<Link
								to={`/news-room/${featuredArticle.slug}`}
								viewTransition
								className="group block"
							>
								<article className="border-border/70 bg-card/15 hover:border-border grid gap-5 overflow-hidden rounded-2xl border p-3 transition-colors md:grid-cols-[1.15fr_1fr] md:p-4">
									<div className="relative overflow-hidden rounded-xl">
										<img
											src={featuredArticle.coverImage}
											alt=""
											width={1280}
											height={720}
											fetchPriority="high"
											className="aspect-video h-full w-full object-cover"
										/>
										<div className="from-background/85 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
										<div className="absolute right-3 bottom-3 left-3 flex flex-wrap gap-2 text-xs">
											<Badge
												variant="outline"
												className="capitalize backdrop-blur-xl"
											>
												Featured
											</Badge>
											<Badge
												variant="outline"
												className="capitalize backdrop-blur-xl"
											>
												{featuredArticle.category}
											</Badge>
										</div>
									</div>

									<div className="flex min-w-0 flex-col justify-between p-1 md:p-3">
										<div>
											<p className="text-muted-foreground mb-3 text-xs tracking-wide uppercase">
												{formatNewsDate(featuredArticle.publishedAt)} •{' '}
												{featuredArticle.readingTimeMinutes} min read
											</p>
											<h2 className="mb-3 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
												{featuredArticle.title}
											</h2>
											<p className="text-muted-foreground max-w-xl text-base leading-relaxed md:text-lg">
												{featuredArticle.excerpt}
											</p>
										</div>

										<footer className="text-muted-foreground mt-6 flex flex-wrap items-center gap-2 text-sm">
											<span className="text-foreground font-semibold">
												{featuredArticle.author.name}
											</span>
											<span>•</span>
											<span>{featuredArticle.author.role}</span>
										</footer>
									</div>
								</article>
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
										<article className="border-border/70 bg-card/15 hover:border-border rounded-2xl border p-4 transition-colors md:p-5">
											<p className="text-muted-foreground mb-2 text-xs">
												{formatNewsDate(article.publishedAt)} •{' '}
												{article.readingTimeMinutes} min read
											</p>
											<h3 className="mb-2 text-xl leading-tight font-semibold tracking-tight text-balance md:text-2xl">
												<span className="group-hover:text-foreground/85 transition-colors">
													{article.title}
												</span>
											</h3>
											<p className="text-muted-foreground mb-4 text-sm leading-relaxed md:text-base">
												{article.excerpt}
											</p>
											<div className="mb-4 flex flex-wrap gap-2">
												<Badge variant="outline" className="capitalize">
													{article.category}
												</Badge>
												{article.tags.slice(0, 2).map((item) => (
													<Badge
														key={item}
														variant="secondary"
														className="font-normal"
													>
														{item}
													</Badge>
												))}
											</div>
											<footer className="text-muted-foreground text-sm">
												<span className="text-foreground font-medium">
													{article.author.name}
												</span>
												<span className="mx-2">•</span>
												<span>{article.author.role}</span>
											</footer>
										</article>
									</Link>
								))}
							</div>
						) : null}
					</>
				)}
			</section>
		</div>
	)
}
