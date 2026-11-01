/*
  What the newsroom's pages share with the browser: the shape of an article and
  how its dates read. The bodies and the manifest that lists them are
  `news-manifest.server.ts`, which only loaders import, so a component that
  needs a type or a date does not carry every article to the client with it.
*/
import { formatShortDate } from '../../constants/limit-format'

import type { ArticleCta } from './article-cta'

export interface NewsAuthor {
	name: string
	role: string
	bio?: string
	avatar?: string
	linkedinUrl?: string
}

export interface NewsArticleFrontmatter {
	title: string
	slug?: string
	excerpt: string
	/**
	 * When the article goes live, as ISO 8601. A future value schedules it: it
	 * can be merged and deployed now, is shown early on staging with a
	 * "Scheduled for" label, and appears on production on its own at this time.
	 *
	 * Without an offset it is Europe/Berlin time: `2026-11-03` is 00:00 that day
	 * in Berlin, `2026-11-03T09:00` is 09:00 in Berlin. Add `Z` or an offset to
	 * mean another zone. See `news-schedule.ts`.
	 */
	publishedAt: string
	updatedAt?: string
	category: string
	tags: string[]
	author: NewsAuthor
	/** WebP used as the og:image / SEO social card (mosaic + text panel). */
	coverImage?: string
	/**
	 * The generated scene as a 1200x630 WebP, with no text baked in. One file
	 * serves both the article hero and the listing's featured block; `coverImage`
	 * is the same scene with the og text composited on top.
	 */
	sceneImage?: string
	/** Overrides the slug-derived scene seed. Set by hand from /__scenes. */
	heroSeed?: number
	/** Replaces the generated hero with a real image. Use sparingly - see the spec. */
	heroImage?: string
	/** Where the closing panel sends the reader: a vectreal.com /publisher or /convert URL, or `agent`. See `resolveArticleCta`. */
	cta?: string
	/** With `cta: agent`, the task handed to the reader's assistant: one sentence, at most 200 characters. */
	ctaPrompt?: string
	/** Never shown outside the dev server, whatever `publishedAt` says. */
	draft?: boolean
}

export interface NewsArticle {
	slug: string
	title: string
	excerpt: string
	publishedAt: string
	updatedAt?: string
	category: string
	tags: string[]
	author: NewsAuthor
	/** WebP used as the og:image / SEO social card (mosaic + text panel). */
	coverImage?: string
	/**
	 * The generated scene as a 1200x630 WebP, with no text baked in. One file
	 * serves both the article hero and the listing's featured block; `coverImage`
	 * is the same scene with the og text composited on top.
	 */
	sceneImage?: string
	/** Overrides the slug-derived scene seed. Set by hand from /__scenes. */
	heroSeed?: number
	/** Replaces the generated hero with a real image. Use sparingly - see the spec. */
	heroImage?: string
	cta: ArticleCta
	draft: boolean
	readingTimeMinutes: number
	sourcePath: string
	/** Which body chunk to load: opaque, so no bundle names an article. */
	bodyId: string
	editUrl: string
}

export function formatNewsDate(dateValue: string): string {
	const parsed = Date.parse(dateValue)
	if (Number.isNaN(parsed)) {
		return dateValue
	}

	return formatShortDate(parsed)
}
