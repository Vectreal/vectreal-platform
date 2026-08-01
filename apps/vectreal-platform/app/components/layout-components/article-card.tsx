import { Badge } from '@shared/components/ui/badge'
import { cn } from '@shared/utils'
import { Link } from 'react-router'

import { ArticleMeta } from './article-meta'
import { AuthorChip } from './author-chip'
import BasicCard from './basic-card'
import { formatNewsDate } from '../../lib/news/news-manifest'

import type { NewsArticle } from '../../lib/news/news-manifest'

/**
 * Only what the card renders. `NewsArticle` carries the MDX `Component`, which
 * the loaders strip on the way to the client, so requiring the whole type here
 * would demand a field the route can never hand over.
 */
type ArticleSummary = Omit<NewsArticle, 'Component'>

interface ArticleCardProps {
	article: ArticleSummary
	/**
	 * featured - the lead card, image on the right, largest title
	 * grid     - the two-up feed below it, thumbnail strip on the right
	 * compact  - the related-articles rail, no image and no author
	 */
	variant?: 'featured' | 'grid' | 'compact'
	className?: string
}

/**
 * A link to an article, at one of three densities.
 *
 * Written out three times before, and the differences between them were not
 * the density: the titles came from three separate raw type scales
 * (`text-3xl md:text-5xl`, `text-xl md:text-2xl`, `text-base`), the meta rows
 * used two separators and two letter-spacings, and the category was
 * `text-primary` on two of them - plain foreground, so the accent it was
 * reaching for never appeared.
 */
export function ArticleCard({
	article,
	variant = 'grid',
	className
}: ArticleCardProps) {
	const meta = (
		<ArticleMeta
			category={article.category}
			items={[
				formatNewsDate(article.publishedAt),
				`${article.readingTimeMinutes} min read`
			]}
		/>
	)

	if (variant === 'compact') {
		return (
			<Link to={`/news-room/${article.slug}`} viewTransition className="group">
				<BasicCard cardClassName={cn('flex flex-col gap-3 p-5', className)}>
					{meta}
					<h3 className="line-clamp-3 leading-snug font-medium">
						{article.title}
					</h3>
					<p className="text-muted-foreground line-clamp-3 text-sm">
						{article.excerpt}
					</p>
				</BasicCard>
			</Link>
		)
	}

	const isFeatured = variant === 'featured'

	return (
		<Link
			to={`/news-room/${article.slug}`}
			viewTransition
			className="group block"
		>
			<BasicCard
				as={isFeatured ? 'article' : 'div'}
				highlight
				cardClassName={cn(
					'overflow-hidden py-0',
					isFeatured
						? 'grid md:grid-cols-[1fr_280px]'
						: 'grid grid-cols-[1fr_auto]',
					className
				)}
			>
				{/*
				  The featured card shows its image as a banner on narrow screens and
				  as a right-hand panel from `md` up, so it is rendered twice with one
				  hidden at each breakpoint.
				*/}
				{isFeatured && article.thumbnailImage ? (
					<div className="col-span-full h-20 overflow-hidden md:hidden">
						<img
							src={article.thumbnailImage}
							alt=""
							width={1200}
							height={160}
							fetchPriority="high"
							className="h-full w-full object-cover object-center"
						/>
					</div>
				) : null}

				<div
					className={cn(
						'flex flex-col justify-between',
						isFeatured ? 'p-6 md:p-9' : 'p-5 md:p-6'
					)}
				>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2.5">
							{isFeatured ? (
								<Badge variant="secondary" className="text-eyebrow">
									Featured
								</Badge>
							) : null}
							{meta}
						</div>

						{isFeatured ? (
							<h2 className="text-headline group-hover:text-foreground/85 max-w-xl transition-colors">
								{article.title}
							</h2>
						) : (
							<h3 className="text-h3 group-hover:text-foreground/85 transition-colors">
								{article.title}
							</h3>
						)}

						<p
							className={cn(
								'text-muted-foreground line-clamp-3 leading-relaxed',
								isFeatured ? 'text-body-lg max-w-xl' : 'text-sm'
							)}
						>
							{article.excerpt}
						</p>
					</div>

					<footer className="mt-6 flex flex-wrap items-center gap-3">
						<AuthorChip author={article.author} compact={!isFeatured} />
					</footer>
				</div>

				{article.thumbnailImage ? (
					<div
						className={cn(
							'relative overflow-hidden',
							isFeatured ? 'hidden md:block' : 'w-14 md:w-24'
						)}
					>
						<img
							src={article.thumbnailImage}
							alt=""
							width={isFeatured ? 280 : 112}
							height={isFeatured ? 520 : 300}
							fetchPriority={isFeatured ? 'high' : undefined}
							className="h-full w-full object-cover object-center"
						/>
					</div>
				) : null}
			</BasicCard>
		</Link>
	)
}
