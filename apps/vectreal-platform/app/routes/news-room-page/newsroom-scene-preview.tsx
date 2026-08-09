import { Button } from '@shared/components/ui/button'
import { useMemo, useState } from 'react'

import { getNewsArticles } from '../../lib/news/news-manifest'
import { SCENE_SURFACE } from '../../lib/newsroom-thumbnail/palette'
import { seedFromSlug } from '../../lib/newsroom-thumbnail/prng'
import { renderSvg } from '../../lib/newsroom-thumbnail/render-svg'
import {
	PREVIEW_GRID,
	heightfield
} from '../../lib/newsroom-thumbnail/scenes/heightfield'

import type { Route } from './+types/newsroom-scene-preview'

const VIEWPORT = { width: 1200, height: 480 }

export async function loader() {
	if (!import.meta.env.DEV) {
		throw new Response('Not found', { status: 404 })
	}

	return {
		articles: getNewsArticles().map((article) => ({
			slug: article.slug,
			title: article.title,
			heroSeed: article.heroSeed ?? null
		}))
	}
}

function SceneTile({
	slug,
	title,
	initialSeed
}: {
	slug: string
	title: string
	initialSeed: number
}) {
	const [seed, setSeed] = useState(initialSeed)
	const isOverridden = seed !== seedFromSlug(slug)

	const svg = useMemo(
		() =>
			renderSvg(heightfield(seed, { viewport: VIEWPORT, grid: PREVIEW_GRID }), {
				viewport: VIEWPORT,
				background: true
			}),
		[seed]
	)

	return (
		<figure className="overflow-hidden rounded-xl border border-white/10">
			<div
				className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
				style={{ backgroundColor: SCENE_SURFACE.background }}
				dangerouslySetInnerHTML={{ __html: svg }}
			/>
			<figcaption
				className="flex items-center justify-between gap-3 p-3"
				style={{ backgroundColor: SCENE_SURFACE.background }}
			>
				<div className="min-w-0">
					<p
						className="truncate text-sm font-medium"
						style={{ color: SCENE_SURFACE.text }}
					>
						{title}
					</p>
					<p
						className="font-mono text-xs"
						style={{ color: SCENE_SURFACE.mutedText }}
					>
						heroSeed: {seed}
						{isOverridden ? '' : ' (from slug)'}
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
					<Button
						size="sm"
						variant="secondary"
						onClick={() => setSeed(Math.floor(Math.random() * 2 ** 32))}
					>
						Shuffle
					</Button>
					{isOverridden ? (
						// Ghost variant renders dark-on-dark against this fixed dark
						// caption bar, so it gets explicit light type.
						<Button
							size="sm"
							variant="ghost"
							className="hover:bg-white/10"
							style={{ color: SCENE_SURFACE.mutedText }}
							onClick={() => setSeed(seedFromSlug(slug))}
						>
							Reset
						</Button>
					) : null}
				</div>
			</figcaption>
		</figure>
	)
}

/**
 * Dev-only contact sheet.
 *
 * Whether ten articles read as varied or as ten near-identical pages is the
 * risk most likely to sink this direction, and it cannot be judged one article
 * at a time. Shuffle until a scene looks right, then paste the printed seed
 * into that article's frontmatter as `heroSeed`.
 */
export default function NewsroomScenePreview({
	loaderData
}: Route.ComponentProps) {
	return (
		<div className="container-page pt-28 pb-12">
			<h1 className="text-h3 mb-2">Newsroom scenes</h1>
			<p className="text-muted-foreground mb-8 text-sm">
				Dev only. Shuffle to explore seeds, then copy the number into that
				article&apos;s <code>heroSeed</code> frontmatter field and re-run{' '}
				<code>nx run vectreal-platform:gen-thumbnails</code>.
			</p>

			<div className="grid gap-6 lg:grid-cols-2">
				{loaderData.articles.map((article) => (
					<SceneTile
						key={article.slug}
						slug={article.slug}
						title={article.title}
						initialSeed={article.heroSeed ?? seedFromSlug(article.slug)}
					/>
				))}
			</div>
		</div>
	)
}
