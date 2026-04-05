import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Search } from 'lucide-react'
import { data, Form, Link } from 'react-router'

import {
	formatNewsDate,
	getNewsArticles,
	getNewsCategories,
	getNewsTags
} from '../../lib/news/news-manifest'
import { buildMeta } from '../../lib/seo'

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
	return buildMeta(
		[
			{ title: 'News Room — Vectreal' },
			{ property: 'og:title', content: 'News Room — Vectreal' },
			{
				name: 'description',
				content: 'News and product notes from the Vectreal team.'
			},
			{
				property: 'og:description',
				content: 'News and product notes from the Vectreal team.'
			}
		],
		undefined,
		{ canonical: '/news-room' }
	)
}

export default function NewsRoomPage({ loaderData }: Route.ComponentProps) {
	const { articles, categories, tags, filters } = loaderData

	return (
		<div className="mx-auto w-full max-w-6xl px-5 pt-24 pb-18 md:px-8">
			<header className="mb-10 space-y-3">
				<p className="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
					Newsroom
				</p>
				<h1 className="max-w-3xl text-4xl leading-[1.08] font-black tracking-tight md:text-6xl">
					Learn about what's new and what's next at Vectreal.
				</h1>
				<p className="text-muted-foreground max-w-2xl text-sm leading-relaxed md:text-base">
					Launches, engineering notes, and product decisions. Cleanly published
					from MDX.
				</p>
			</header>

			<section className="border-border/60 bg-muted/15 mb-10 rounded-2xl border p-4 md:p-5">
				<Form method="get" className="grid gap-3 md:grid-cols-5">
					<label className="relative block md:col-span-2">
						<Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
						<input
							type="search"
							name="q"
							defaultValue={filters.query}
							placeholder="Search posts"
							className="border-input bg-background/60 placeholder:text-muted-foreground focus-visible:ring-ring h-10 w-full rounded-md border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
						/>
					</label>

					<select
						name="category"
						defaultValue={filters.category}
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
						className="border-input bg-background/60 h-10 rounded-md border px-3 text-sm"
					>
						<option value="newest">Newest first</option>
						<option value="oldest">Oldest first</option>
					</select>

					<div className="flex items-center gap-2 md:col-span-5">
						<Button type="submit">Apply</Button>
						<Button variant="ghost" asChild>
							<Link to="/news-room">Reset</Link>
						</Button>
					</div>
				</Form>
			</section>

			<section className="space-y-3">
				{articles.length === 0 ? (
					<div className="border-border/50 bg-muted/10 rounded-2xl border p-10 text-center">
						<h2 className="mb-1 text-lg font-semibold">No matching posts</h2>
						<p className="text-muted-foreground text-sm">
							Try another filter or clear search.
						</p>
					</div>
				) : (
					articles.map((article) => (
						<Link
							key={article.slug}
							to={`/news-room/${article.slug}`}
							viewTransition
							className="text-foreground/75 hover:text-foreground block font-medium"
						>
							<article className="border-border/70 bg-card/15 group hover:border-border grid grid-rows-[auto_1fr] gap-3 rounded-2xl border p-5 transition-colors md:p-6 md:py-4">
								<div className="relative -mx-2 overflow-hidden rounded-md">
									<img
										src={article.coverImage}
										alt=""
										className="aspect-video max-h-64 w-full object-cover"
									/>
									<div className="from-background/80 absolute inset-0 bg-gradient-to-t" />

									<div className="absolute bottom-0 flex flex-wrap items-center gap-2 p-2 text-xs">
										<Badge
											variant="outline"
											className="capitalize backdrop-blur-xl"
										>
											{article.category}
										</Badge>
										{article.draft ? (
											<Badge variant="secondary" className="uppercase">
												Draft
											</Badge>
										) : null}
										<span className="text-muted-foreground">
											{formatNewsDate(article.publishedAt)}
										</span>
										<span className="text-muted-foreground">•</span>
										<span className="text-muted-foreground">
											{article.readingTimeMinutes} min read
										</span>
									</div>
								</div>

								<div>
									<h2 className="mb-2 text-2xl leading-tight font-bold tracking-tight md:text-3xl">
										<span className="group-hover:text-foreground/85 transition-colors">
											{article.title}
										</span>
									</h2>

									<p className="text-muted-foreground mb-4 max-w-3xl text-sm leading-relaxed md:text-base">
										{article.excerpt}
									</p>

									<div className="mb-4 flex flex-wrap gap-2">
										{article.tags.map((item) => (
											<Badge
												key={item}
												variant="secondary"
												className="font-normal"
											>
												{item}
											</Badge>
										))}
									</div>

									<footer className="text-muted-foreground flex items-center justify-between text-sm">
										<div>
											<span className="text-foreground font-medium">
												{article.author.name}
											</span>
											<span className="mx-2">•</span>
											<span>{article.author.role}</span>
										</div>
									</footer>
								</div>
							</article>
						</Link>
					))
				)}
			</section>
		</div>
	)
}
