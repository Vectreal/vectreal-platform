import { cn } from '@shared/utils'
import { Link } from 'react-router'

import BasicCard from './basic-card'
import { newsroomMorphNames } from '../../lib/news/article-view-transition'
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
 *
 * It is built on the same `BasicCard` as the hero rather than a hand-rolled
 * bordered `Link`, so "matches the article hero" is structural instead of two
 * class lists that have to be kept in step by hand. The `Link` wraps the card
 * because `BasicCard` renders a block element, not an anchor.
 *
 * Every layer carries a `view-transition-name` so clicking through morphs this
 * card into the article hero rather than cross-fading to it. The scene and the
 * scrim repeat the card's `rounded-2xl` because a named element is snapshotted
 * without its ancestors' clipping - without it the corners square off for the
 * length of the flight. The excerpt is named but deliberately unpaired: it has
 * no counterpart inside the hero, so it fades where it sits instead of flying
 * down to the article's standfirst. See `lib/news/article-view-transition.ts`.
 */
export function FeaturedArticle({ article, className }: FeaturedArticleProps) {
	const morph = newsroomMorphNames(article.slug)

	return (
		<Link
			to={`/news-room/${article.slug}`}
			viewTransition
			className={cn('group block', className)}
		>
			<BasicCard
				cardClassName="vt-news-plate relative isolate overflow-hidden border-white/10 p-0"
				cardStyle={{
					backgroundColor: SCENE_SURFACE.background,
					viewTransitionName: morph.card
				}}
			>
				<div className="relative z-20 flex min-h-[19rem] flex-col justify-end p-6 md:min-h-[24rem] md:p-9">
					<p
						className="text-orange text-eyebrow vt-news-text mb-3"
						style={{ viewTransitionName: morph.eyebrow }}
					>
						{article.category} · Featured
					</p>

					<h2
						className="text-headline vt-news-text mb-3 max-w-[19ch] text-balance transition-opacity group-hover:opacity-85"
						style={{
							color: SCENE_SURFACE.text,
							viewTransitionName: morph.title
						}}
					>
						{article.title}
					</h2>

					<p
						className="vt-news-text mb-4 line-clamp-2 max-w-[56ch] text-sm leading-relaxed md:text-base"
						style={{
							color: SCENE_SURFACE.excerptText,
							viewTransitionName: morph.excerpt
						}}
					>
						{article.excerpt}
					</p>

					<p
						className="vt-news-text text-xs"
						style={{
							color: SCENE_SURFACE.mutedText,
							viewTransitionName: morph.meta
						}}
					>
						{formatNewsDate(article.publishedAt)} · {article.readingTimeMinutes}{' '}
						min read
					</p>
				</div>

				<div
					aria-hidden
					className="vt-news-plate absolute inset-0 z-10 rounded-2xl"
					style={{
						background: `linear-gradient(to top, ${SCENE_SURFACE.background} 6%, rgba(8, 8, 10, 0.72) 44%, rgba(8, 8, 10, 0) 84%)`,
						viewTransitionName: morph.scrim
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
						className="vt-news-image absolute inset-0 z-0 h-full w-full rounded-2xl object-cover object-center"
						style={{ viewTransitionName: morph.scene }}
					/>
				) : null}
			</BasicCard>
		</Link>
	)
}
