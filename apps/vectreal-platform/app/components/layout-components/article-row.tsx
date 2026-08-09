import { cn } from '@shared/utils'
import { Link } from 'react-router'

import { formatNewsDate } from '../../lib/news/news-manifest'

import type { NewsArticle } from '../../lib/news/news-manifest'

type ArticleSummary = Omit<NewsArticle, 'Component'>

interface ArticleRowProps {
	article: ArticleSummary
	className?: string
}

/**
 * One article in the news-room index: date rail, title and excerpt, category.
 *
 * No artwork and no byline. The scenes are decoration rather than content, so
 * repeating them down the list added noise without adding information, and the
 * author is the same person on nearly every article - it belongs on the article
 * itself, not on every row.
 *
 * The date column is tabular-nums so the rail stays optically straight.
 */
export function ArticleRow({ article, className }: ArticleRowProps) {
	return (
		<Link
			to={`/news-room/${article.slug}`}
			viewTransition
			className={cn(
				'border-border/60 group grid items-baseline gap-x-6 gap-y-1 border-b py-5',
				'grid-cols-1 md:grid-cols-[7rem_1fr_6rem]',
				className
			)}
		>
			<span className="text-muted-foreground order-2 text-xs tabular-nums md:order-none md:pt-0.5">
				{formatNewsDate(article.publishedAt)}
			</span>

			<div className="order-1 md:order-none">
				<h3 className="group-hover:text-orange mb-1.5 text-lg leading-snug font-medium tracking-tight transition-colors">
					{article.title}
				</h3>
				<p className="text-muted-foreground line-clamp-2 max-w-[68ch] text-sm leading-relaxed">
					{article.excerpt}
				</p>
			</div>

			<span className="text-muted-foreground text-eyebrow order-3 md:order-none md:pt-1 md:text-right">
				{article.category}
			</span>
		</Link>
	)
}
