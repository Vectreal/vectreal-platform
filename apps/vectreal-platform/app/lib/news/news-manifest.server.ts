import { isValidElement } from 'react'

import { AGENT_CTA_PROMPT_MAX_LENGTH, resolveArticleCta } from './article-cta'
import {
	isArticleBodyChunkPath,
	isNewsArticleLive,
	isScheduledAt,
	newsSlugFromRequestPath,
	normalizeRequestPath,
	resolvePublishedAt
} from './news-schedule'
import { isCanonicalDeployment } from '../deployment-origin'
import { COMMUNITY } from '../navigation/site-map'
import { normalizeSlug } from '../utils/slug'

import type { NewsArticle, NewsArticleFrontmatter } from './news-article'
import type { ComponentType, ReactNode } from 'react'

const GITHUB_DEFAULT_BRANCH = 'main'

interface MdxNewsModule {
	default: ComponentType<Record<string, unknown>>
	frontmatter?: Partial<NewsArticleFrontmatter>
}

/*
  Every article, compiled. This module is `.server` so that only loaders reach
  it: the browser loads one body at a time through `news-article-body.ts`.

  Reading time is counted from the rendered text. A `?raw` glob looks like the
  obvious source, but the MDX plugin compiles `*.mdx?raw` as well, so it hands
  back the same component and never the text.
*/
const articleModules = import.meta.glob<MdxNewsModule>(
	'../../routes/news-room-page/articles/*.mdx',
	{ eager: true }
)

const DEV = import.meta.env.DEV

function isDraftArticle(frontmatter: { draft?: boolean }): boolean {
	return Boolean(frontmatter.draft)
}

function canShowArticle(frontmatter: { draft?: boolean }): boolean {
	return DEV || !isDraftArticle(frontmatter)
}

/**
 * True while React Router is prerendering at build time.
 *
 * `IS_RR_BUILD_REQUEST` is React Router's own marker for its build requests:
 * its prerender plugin sets it on the build process, and the server runtime
 * reads it to trust prerender-only headers. Nothing in the app sets it, and a
 * running server never has it.
 *
 * The prerender has to render a scheduled article, because one image serves
 * both staging and production and staging shows it early. Should a React
 * Router release stop setting the marker, the build fails on a scheduled
 * article's 404 instead of anything leaking, and `news-schedule-build.spec.ts`
 * fails before that.
 */
function isPrerenderRequest(): boolean {
	return process.env.IS_RR_BUILD_REQUEST === 'yes'
}

/**
 * Whether this deployment shows scheduled articles before their time:
 * staging, the dev server and the prerender. Production does not.
 *
 * Read per call rather than once, so the answer follows `APPLICATION_URL`.
 * An unreadable `APPLICATION_URL` counts as production (see
 * `deployment-origin.ts`), which here fails toward hiding.
 */
function previewsScheduledArticles(): boolean {
	return import.meta.env.DEV || isPrerenderRequest() || !isCanonicalDeployment()
}

function parseDateValue(value: string | undefined): number {
	if (!value) {
		return 0
	}

	const date = resolvePublishedAt(value)
	return Number.isNaN(date) ? 0 : date
}

function calculateReadingTimeMinutes(content: string): number {
	const stripped = content
		.replace(/^---[\s\S]*?---\s*/m, ' ')
		.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
		.replace(/^import\s.+$/gm, ' ')
		.replace(/^export\s.+$/gm, ' ')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/[#_*~\-\[\]()]/g, ' ')

	const words = stripped.split(/\s+/).filter(Boolean).length
	return Math.max(1, Math.ceil(words / 100))
}

function getComponentTextSource(
	component: ComponentType<Record<string, unknown>> | undefined
): string {
	if (typeof component !== 'function') {
		return ''
	}

	// Class components are not directly callable in TypeScript.
	if ('prototype' in component && component.prototype?.isReactComponent) {
		return ''
	}

	try {
		const rendered = (
			component as (props: Record<string, unknown>) => ReactNode
		)({})
		return extractTextFromReactNode(rendered)
	} catch {
		return ''
	}
}

function extractTextFromReactNode(node: ReactNode): string {
	if (typeof node === 'string' || typeof node === 'number') {
		return String(node)
	}

	if (Array.isArray(node)) {
		return node.map((child) => extractTextFromReactNode(child)).join(' ')
	}

	if (!isValidElement(node)) {
		return ''
	}

	const children = (node.props as { children?: ReactNode }).children
	return extractTextFromReactNode(children)
}

function getFileName(moduleKey: string): string {
	const parts = moduleKey.split('?')[0].split('/')
	return parts[parts.length - 1] ?? ''
}

function toSourcePath(moduleKey: string): string {
	const fileName = getFileName(moduleKey)
	return `apps/vectreal-platform/app/routes/news-room-page/articles/${fileName}`
}

function toEditUrl(sourcePath: string): string {
	return `${COMMUNITY.github}/blob/${GITHUB_DEFAULT_BRANCH}/${sourcePath}`
}

function validateFrontmatter(
	moduleKey: string,
	frontmatter: Partial<NewsArticleFrontmatter> | undefined
): { isValid: boolean; reason?: string } {
	if (!frontmatter) {
		return { isValid: false, reason: 'Missing frontmatter.' }
	}

	if (!frontmatter.title?.trim()) {
		return { isValid: false, reason: 'Missing required field: title.' }
	}

	if (!frontmatter.excerpt?.trim()) {
		return { isValid: false, reason: 'Missing required field: excerpt.' }
	}

	if (!frontmatter.publishedAt?.trim()) {
		return { isValid: false, reason: 'Missing required field: publishedAt.' }
	}

	if (!frontmatter.category?.trim()) {
		return { isValid: false, reason: 'Missing required field: category.' }
	}

	if (!frontmatter.author?.name?.trim()) {
		return { isValid: false, reason: 'Missing required field: author.name.' }
	}

	if (!frontmatter.author?.role?.trim()) {
		return { isValid: false, reason: 'Missing required field: author.role.' }
	}

	const publishedAt = resolvePublishedAt(frontmatter.publishedAt)
	if (Number.isNaN(publishedAt)) {
		return {
			isValid: false,
			reason: 'Invalid publishedAt date. Use ISO format.'
		}
	}

	if (
		frontmatter.updatedAt &&
		Number.isNaN(Date.parse(frontmatter.updatedAt))
	) {
		return {
			isValid: false,
			reason: 'Invalid updatedAt date. Use ISO format.'
		}
	}

	if (frontmatter.tags && !Array.isArray(frontmatter.tags)) {
		return { isValid: false, reason: 'tags must be an array of strings.' }
	}

	return { isValid: true }
}

const allArticles: NewsArticle[] = Object.entries(articleModules)
	.map<NewsArticle | null>(([moduleKey, { default: Body, frontmatter }]) => {
		const validation = validateFrontmatter(moduleKey, frontmatter)
		if (!validation.isValid) {
			if (DEV && validation.reason) {
				console.warn(
					`Newsroom article skipped (${moduleKey}): ${validation.reason}`
				)
			}
			return null
		}

		if (!canShowArticle(frontmatter ?? {})) {
			return null
		}

		const cta = resolveArticleCta(frontmatter?.cta, frontmatter?.ctaPrompt)
		if (!cta) {
			if (DEV) {
				console.warn(
					`Newsroom article skipped (${moduleKey}): cta must be a vectreal.com /publisher or /convert URL, or agent with a ctaPrompt of at most ${AGENT_CTA_PROMPT_MAX_LENGTH} characters.`
				)
			}
			return null
		}

		const fileName = getFileName(moduleKey)
		const slug =
			normalizeSlug(frontmatter?.slug ?? '') ||
			normalizeSlug(fileName.replace(/\.mdx$/i, ''))

		const sourcePath = toSourcePath(moduleKey)

		const article: NewsArticle = {
			slug,
			title: frontmatter?.title?.trim() ?? '',
			excerpt: frontmatter?.excerpt?.trim() ?? '',
			publishedAt: frontmatter?.publishedAt ?? '',
			...(frontmatter?.updatedAt ? { updatedAt: frontmatter.updatedAt } : {}),
			category: frontmatter?.category?.trim() ?? 'general',
			tags: Array.isArray(frontmatter?.tags)
				? frontmatter.tags.filter(Boolean)
				: [],
			author: {
				name: frontmatter?.author?.name?.trim() ?? '',
				role: frontmatter?.author?.role?.trim() ?? '',
				bio: frontmatter?.author?.bio,
				avatar: frontmatter?.author?.avatar,
				linkedinUrl: frontmatter?.author?.linkedinUrl
			},
			coverImage: frontmatter?.coverImage,
			sceneImage: frontmatter?.sceneImage,
			...(typeof frontmatter?.heroSeed === 'number'
				? { heroSeed: frontmatter.heroSeed }
				: {}),
			...(frontmatter?.heroImage ? { heroImage: frontmatter.heroImage } : {}),
			cta,
			draft: Boolean(frontmatter?.draft),
			readingTimeMinutes: calculateReadingTimeMinutes(
				getComponentTextSource(Body)
			),
			sourcePath,
			editUrl: toEditUrl(sourcePath)
		}

		return article
	})
	.filter((article): article is NewsArticle => article !== null)
	.sort((a, b) => parseDateValue(b.publishedAt) - parseDateValue(a.publishedAt))

function isVisibleHere(article: NewsArticle, now: number): boolean {
	return isNewsArticleLive(article.publishedAt, now, {
		previewScheduled: previewsScheduledArticles()
	})
}

function isPublishedBy(article: NewsArticle, now: number): boolean {
	return !isScheduledAt(article.publishedAt, now)
}

/**
 * Every article this deployment shows right now: on production the live ones,
 * on staging and in dev the scheduled ones as well. For the pages that render
 * per request, so an article appears once its time has passed.
 */
export function getNewsArticles(now = Date.now()): NewsArticle[] {
	return allArticles.filter((article) => isVisibleHere(article, now))
}

/**
 * Every article whose time has passed, wherever this runs. For what is written
 * into prerendered HTML, which staging and production share, and for
 * `llms.txt`, whose links always name production.
 */
export function getPublishedNewsArticles(now = Date.now()): NewsArticle[] {
	return allArticles.filter((article) => isPublishedBy(article, now))
}

export function getNewsArticle(
	slug: string,
	now = Date.now()
): NewsArticle | undefined {
	const article = allArticles.find((entry) => entry.slug === slug)
	return article && isVisibleHere(article, now) ? article : undefined
}

/**
 * True when `pathname` reaches a file that holds an article this deployment
 * must not show yet: its prerendered page, `.data` payload or markdown twin
 * (see `newsSlugFromRequestPath`), the client chunk with its compiled body, or
 * an image its frontmatter names. The og image has the title baked into it.
 *
 * `server.mjs` reads this from the server build and sends such a request to
 * the app instead of `express.static`, so it gets the app's own 404.
 *
 * Images an article's body embeds are not covered: only the MDX knows them.
 */
export function isUnpublishedNewsPath(
	pathname: string,
	now = Date.now()
): boolean {
	const withheld = allArticles.filter((article) => !isVisibleHere(article, now))
	if (withheld.length === 0) return false

	const path = normalizeRequestPath(pathname)
	if (path === null) return false

	const slug = newsSlugFromRequestPath(path)
	return withheld.some(
		(article) =>
			article.slug.toLowerCase() === slug ||
			isArticleBodyChunkPath(article.sourcePath, path) ||
			[article.coverImage, article.sceneImage, article.heroImage].some(
				(image) => image !== undefined && image.toLowerCase() === path
			)
	)
}

export function getNewsCategories(now = Date.now()): string[] {
	return Array.from(
		new Set(getNewsArticles(now).map((article) => article.category))
	).sort((a, b) => a.localeCompare(b))
}

/*
  Cross-links are written into prerendered HTML, which is the same bytes on
  staging and production, so they only ever name articles already published
  when the page was built. A scheduled article links out to published ones; an
  older article does not link to a newly live one until the next deploy.
*/
function crossLinkCandidates(slug: string, now: number): NewsArticle[] {
	return allArticles.filter(
		(article) => article.slug === slug || isPublishedBy(article, now)
	)
}

export function getAdjacentNewsArticles(
	slug: string,
	now = Date.now()
): {
	previous?: NewsArticle
	next?: NewsArticle
} {
	const articles = crossLinkCandidates(slug, now)
	const index = articles.findIndex((article) => article.slug === slug)
	if (index === -1) {
		return {}
	}

	return {
		previous: articles[index + 1],
		next: articles[index - 1]
	}
}

export function getRelatedNewsArticles(
	slug: string,
	limit = 3,
	now = Date.now()
): NewsArticle[] {
	const currentArticle = allArticles.find((article) => article.slug === slug)
	if (!currentArticle) {
		return []
	}

	const currentTags = new Set(currentArticle.tags)

	return crossLinkCandidates(slug, now)
		.filter((article) => article.slug !== slug)
		.map((article) => {
			const sharedTagsCount = article.tags.filter((tag) =>
				currentTags.has(tag)
			).length

			const sameCategoryBonus =
				article.category === currentArticle.category ? 1 : 0

			return {
				article,
				score: sharedTagsCount * 3 + sameCategoryBonus
			}
		})
		.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score
			}
			return (
				parseDateValue(b.article.publishedAt) -
				parseDateValue(a.article.publishedAt)
			)
		})
		.slice(0, limit)
		.map((entry) => entry.article)
}
