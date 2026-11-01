import { cn } from '@shared/utils'
import { Link } from 'react-router'

import { ScheduledLabel } from './scheduled-label'
import { formatNewsDate } from '../../lib/news/news-article'

import type { NewsArticle } from '../../lib/news/news-article'

interface ArticleRowProps {
	article: NewsArticle
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
 *
 * The rows are ruled into the sheet frame from rule to rule, with a rule
 * under each, rather than each sitting in a box of its own. The faint fill on
 * hover is what says a row is a link, as on the home page's format strip; the
 * title is not underlined as well.
 */
export function ArticleRow({ article, className }: ArticleRowProps) {
	return (
		<Link
			to={`/news-room/${article.slug}`}
			viewTransition
			className={cn(
				'border-foreground/10 hover:bg-foreground/3 focus-visible:bg-foreground/3 grid items-baseline gap-x-6 gap-y-1 border-b py-6 transition-colors duration-(--duration-base) lg:px-(--frame-pad)',
				'grid-cols-1 md:grid-cols-[7rem_1fr_6rem]',
				className
			)}
		>
			<span className="text-muted-foreground text-label-xs order-2 tabular-nums md:order-none md:pt-0.5">
				{formatNewsDate(article.publishedAt)}
			</span>

			<div className="order-1 md:order-none">
				<h3 className="text-h4 mb-1.5">{article.title}</h3>
				<p className="text-muted-foreground text-body-sm line-clamp-2 max-w-[68ch]">
					{article.excerpt}
				</p>
				<ScheduledLabel
					publishedAt={article.publishedAt}
					className="text-muted-foreground text-label-xs mt-2"
				/>
			</div>

			<span className="text-muted-foreground text-eyebrow order-3 md:order-none md:pt-1 md:text-right">
				{article.category}
			</span>
		</Link>
	)
}
