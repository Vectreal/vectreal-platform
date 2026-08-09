import { cn } from '@shared/utils'
import { Link } from 'react-router'

import { formatNewsDate } from '../../lib/news/news-manifest'
import { SCENE_SURFACE } from '../../lib/newsroom-thumbnail/palette'

import type { NewsArticle } from '../../lib/news/news-manifest'

type ArticleSummary = Omit<NewsArticle, 'Component'>

interface FeaturedArticleProps {
	article: ArticleSummary
	className?: string
}

/**
 * The lead story on the news-room index, and the only place artwork appears
 * there.
 *
 * The generated scenes vary by seed but share a silhouette, so ten of them
 * stacked down a listing read as wallpaper rather than as ten articles. Showing
 * exactly one, large, keeps the artwork an event. Everything below this is
 * typographic.
 *
 * Composition matches the article hero and the og:image: scene full-bleed,
 * bottom scrim, text over it. Fixed dark surface because the scene is
 * near-white hairlines and would vanish on a light-theme card.
 */
export function FeaturedArticle({ article, className }: FeaturedArticleProps) {
	return (
		<Link
			to={`/news-room/${article.slug}`}
			viewTransition
			className={cn(
				'group relative block overflow-hidden rounded-2xl border border-white/10',
				className
			)}
			style={{ backgroundColor: SCENE_SURFACE.background }}
		>
			<div className="relative z-20 flex min-h-[19rem] flex-col justify-end p-6 md:min-h-[24rem] md:p-9">
				<p className="text-orange text-eyebrow mb-3">
					{article.category} · Featured
				</p>

				<h2
					className="text-headline mb-3 max-w-[19ch] text-balance transition-opacity group-hover:opacity-85"
					style={{ color: SCENE_SURFACE.text }}
				>
					{article.title}
				</h2>

				<p
					className="mb-4 line-clamp-2 max-w-[56ch] text-sm leading-relaxed md:text-base"
					style={{ color: SCENE_SURFACE.excerptText }}
				>
					{article.excerpt}
				</p>

				<p className="text-xs" style={{ color: SCENE_SURFACE.mutedText }}>
					{formatNewsDate(article.publishedAt)} · {article.readingTimeMinutes}{' '}
					min read
				</p>
			</div>

			<div
				aria-hidden
				className="absolute inset-0 z-10"
				style={{
					background: `linear-gradient(to top, ${SCENE_SURFACE.background} 6%, rgba(8, 8, 10, 0.72) 44%, rgba(8, 8, 10, 0) 84%)`
				}}
			/>

			{article.sceneImage ? (
				<img
					src={article.sceneImage}
					alt=""
					aria-hidden
					width={1200}
					height={630}
					fetchPriority="high"
					className="absolute inset-0 z-0 h-full w-full object-cover object-center"
				/>
			) : null}
		</Link>
	)
}
