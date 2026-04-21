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
		<div className="mx-auto w-full max-w-7xl px-6 pt-24 pb-20">
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

			<section className="space-y-4">
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
								{/*
								 * Featured card — typography-first layout.
								 * On mobile: narrow mosaic strip spans the top as a brand
								 * signature, text fills below. On desktop: mosaic column
								 * sits on the right (~30% width), text dominates the left.
								 */}
								<article className="border-border/70 bg-card/15 hover:border-border overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5">
									{/* Mobile-only pattern strip */}
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
										{/* Text column */}
										<div className="flex flex-col justify-between p-7 md:p-10">
											<div>
												{/* Meta row: Featured badge + category + reading time */}
												<div className="mb-5 flex flex-wrap items-center gap-2.5">
													<span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-[11px] font-semibold tracking-[0.12em] uppercase">
														Featured
													</span>
													<span className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
														{featuredArticle.category}
													</span>
													<span className="text-border">·</span>
													<span className="text-muted-foreground text-[11px]">
														{featuredArticle.readingTimeMinutes} min read
													</span>
												</div>

												<h2 className="group-hover:text-foreground/85 mb-4 text-3xl leading-[1.06] font-semibold tracking-tight text-balance transition-colors md:text-5xl">
													{featuredArticle.title}
												</h2>
												<p className="text-muted-foreground max-w-xl text-base leading-relaxed md:text-lg">
													{featuredArticle.excerpt}
												</p>
											</div>

											<footer className="border-border/40 mt-8 flex flex-wrap items-center gap-3 border-t pt-5">
												<div>
													<p className="text-sm leading-tight font-semibold">
														{featuredArticle.author.name}
													</p>
													<p className="text-muted-foreground text-xs">
														{featuredArticle.author.role} ·{' '}
														{formatNewsDate(featuredArticle.publishedAt)}
													</p>
												</div>
											</footer>
										</div>

										{/* Desktop-only mosaic accent column */}
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
										{/*
										 * Grid card — horizontal split.
										 * Text takes the left ~¾, mosaic is a narrow
										 * accent strip on the right — always visible,
										 * never the focus.
										 */}
										<article className="border-border/70 bg-card/15 hover:border-border grid grid-cols-[1fr_auto] overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5">
											{/* Text column */}
											<div className="flex flex-col justify-between p-5 md:p-6">
												<div>
													{/* Category + date meta */}
													<div className="mb-3 flex flex-wrap items-center gap-1.5">
														<span className="text-primary text-[11px] font-semibold tracking-[0.12em] uppercase">
															{article.category}
														</span>
														<span className="text-border text-[11px]">·</span>
														<span className="text-muted-foreground text-[11px]">
															{formatNewsDate(article.publishedAt)}
														</span>
													</div>

													<h3 className="group-hover:text-foreground/85 mb-2.5 text-xl leading-snug font-semibold tracking-tight text-balance transition-colors md:text-2xl">
														{article.title}
													</h3>
													<p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed md:text-base">
														{article.excerpt}
													</p>
												</div>

												<footer className="border-border/40 mt-5 flex items-center gap-1.5 border-t pt-4">
													<span className="text-foreground text-xs font-semibold">
														{article.author.name}
													</span>
													<span className="text-border text-xs">·</span>
													<span className="text-muted-foreground text-xs">
														{article.readingTimeMinutes} min read
													</span>
												</footer>
											</div>

											{/* Mosaic accent strip */}
											{article.thumbnailImage ? (
												<div className="border-border/40 relative w-20 overflow-hidden border-l md:w-28">
													<img
														src={article.thumbnailImage}
														alt=""
														width={112}
														height={300}
														className="h-full w-full object-cover object-center"
													/>
												</div>
											) : null}
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
