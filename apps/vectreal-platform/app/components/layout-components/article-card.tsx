import { cn } from '@shared/utils'
import { Link } from 'react-router'

import { ArticleMeta } from './article-meta'
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
	className?: string
}

/**
 * A compact link to an article, used by the "More from the newsroom" rail at
 * the foot of an article.
 *
 * This had `featured` and `grid` variants too, both for the news-room index.
 * The index is now a single featured block plus typographic rows
 * (`FeaturedArticle`, `ArticleRow`), so those variants had no callers and the
 * image handling they carried - a 1200x630 landscape scene squeezed into a
 * 96px-wide vertical strip, cropped to a meaningless slice - went with them.
 */
export function ArticleCard({ article, className }: ArticleCardProps) {
	return (
		<Link to={`/news-room/${article.slug}`} viewTransition className="group">
			<BasicCard cardClassName={cn('flex flex-col gap-3 p-5', className)}>
				<ArticleMeta
					category={article.category}
					items={[
						formatNewsDate(article.publishedAt),
						`${article.readingTimeMinutes} min read`
					]}
				/>
				<h3 className="group-hover:text-orange line-clamp-3 leading-snug font-medium transition-colors">
					{article.title}
				</h3>
				<p className="text-muted-foreground line-clamp-3 text-sm">
					{article.excerpt}
				</p>
			</BasicCard>
		</Link>
	)
}
