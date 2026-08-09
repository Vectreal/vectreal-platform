import { cn } from '@shared/utils'

import { ArticleMeta } from './article-meta'
import BasicCard from './basic-card'
import { formatNewsDate } from '../../lib/news/news-manifest'
import { SCENE_SURFACE } from '../../lib/newsroom-thumbnail/palette'

interface ArticleHeroProps {
	slug: string
	title: string
	category: string
	publishedAt: string
	updatedAt?: string
	/** Generated scene WebP. Also used by the listing's featured block. */
	sceneImage?: string
	/** Author-supplied image that replaces the generated scene. */
	heroImage?: string
	className?: string
}

/**
 * The news-room article header.
 *
 * The scene fills the card and the text sits over a bottom scrim, which is the
 * same composition the og:image uses - one design, rendered once at build time
 * and referenced twice.
 *
 * This used to render the scene as inline SVG at request time so the header
 * cost no network request. Measured, that SVG was heavier than the WebP at
 * equal density, so hitting the byte budget meant shipping a visibly sparser
 * scene AND shipping the whole scene core to the browser. A plain <img> is
 * fewer moving parts and looks better; `fetchPriority` covers the LCP cost.
 *
 * The fixed dark surface is deliberate: the scene is near-white hairlines and
 * would be invisible on a light-theme card, so the hero pins its own background
 * and type colours and reads identically in both themes.
 */
export function ArticleHero({
	title,
	category,
	publishedAt,
	updatedAt,
	sceneImage,
	heroImage,
	className
}: ArticleHeroProps) {
	const image = heroImage ?? sceneImage

	return (
		<BasicCard
			as="header"
			cardClassName={cn(
				'relative isolate overflow-hidden border-white/10 p-0',
				className
			)}
			cardStyle={{ backgroundColor: SCENE_SURFACE.background }}
		>
			<div className="relative z-20 flex min-h-[20rem] flex-col justify-end p-6 md:min-h-[26rem] md:p-9">
				<p className="text-orange text-eyebrow mb-3">{category}</p>

				<h1
					className="text-headline max-w-3xl text-balance"
					style={{ color: SCENE_SURFACE.text }}
				>
					{title}
				</h1>

				<ArticleMeta
					className="mt-4"
					style={{ color: SCENE_SURFACE.mutedText }}
					items={[
						formatNewsDate(publishedAt),
						...(updatedAt ? [`Updated ${formatNewsDate(updatedAt)}`] : [])
					]}
				/>
			</div>

			<div
				aria-hidden
				className="absolute inset-0 z-10"
				style={{
					background: `linear-gradient(to top, ${SCENE_SURFACE.background} 4%, rgba(8, 8, 10, 0.72) 42%, rgba(8, 8, 10, 0) 82%)`
				}}
			/>

			{image ? (
				<img
					src={image}
					alt=""
					aria-hidden
					width={1200}
					height={630}
					fetchPriority="high"
					className="absolute inset-0 z-0 h-full w-full object-cover object-center"
				/>
			) : null}
		</BasicCard>
	)
}
