import { isValidElement } from 'react'

import { normalizeSlug } from '../content/slug'

import type { ComponentType, ReactNode } from 'react'

export interface NewsAuthor {
	name: string
	role: string
	bio?: string
	avatar?: string
	xUrl?: string
	linkedinUrl?: string
}

export interface NewsArticleFrontmatter {
	title: string
	slug?: string
	excerpt: string
	publishedAt: string
	updatedAt?: string
	category: string
	tags: string[]
	author: NewsAuthor
	/** WebP used as the og:image / SEO social card (mosaic + text panel). */
	coverImage?: string
	/** WebP used as the visual card image on the listing page (pure mosaic). */
	thumbnailImage?: string
	draft?: boolean
}

interface MdxNewsModule {
	default: ComponentType<Record<string, unknown>>
	frontmatter?: Partial<NewsArticleFrontmatter>
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
	/** WebP used as the visual card image on the listing page (pure mosaic). */
	thumbnailImage?: string
	draft: boolean
	readingTimeMinutes: number
	sourcePath: string
	editUrl: string
	Component: ComponentType<Record<string, unknown>>
}

const GITHUB_REPO = 'https://github.com/Vectreal/vectreal-platform'
const GITHUB_DEFAULT_BRANCH = 'main'

const articleModules = import.meta.glob<MdxNewsModule>(
	'../../routes/news-room-page/articles/*.mdx',
	{
		eager: true
	}
)

const rawArticleModules = import.meta.glob<unknown>(
	'../../routes/news-room-page/articles/*.mdx',
	{
		eager: true,
		query: '?raw',
		import: 'default'
	}
)

const DEV = import.meta.env.DEV

function isDraftArticle(frontmatter: Partial<NewsArticleFrontmatter>): boolean {
	return Boolean(frontmatter.draft)
}

function canShowArticle(frontmatter: Partial<NewsArticleFrontmatter>): boolean {
	return DEV || !isDraftArticle(frontmatter)
}

function parseDateValue(value: string | undefined): number {
	if (!value) {
		return 0
	}

	const date = Date.parse(value)
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

function getRawArticleSource(moduleEntry: unknown): string {
	if (typeof moduleEntry === 'string') {
		return moduleEntry
	}

	if (
		typeof moduleEntry === 'object' &&
		moduleEntry !== null &&
		'default' in moduleEntry
	) {
		const defaultExport = (moduleEntry as { default?: unknown }).default
		if (typeof defaultExport === 'string') {
			return defaultExport
		}
	}

	return ''
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
	return `${GITHUB_REPO}/blob/${GITHUB_DEFAULT_BRANCH}/${sourcePath}`
}

const rawArticleModulesByNormalizedKey = new Map<string, unknown>(
	Object.entries(rawArticleModules).map(([moduleKey, moduleEntry]) => [
		moduleKey.split('?')[0],
		moduleEntry
	])
)

const rawArticleModulesByFileName = new Map<string, unknown>(
	Object.entries(rawArticleModules).map(([moduleKey, moduleEntry]) => [
		getFileName(moduleKey),
		moduleEntry
	])
)

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

	const publishedAt = Date.parse(frontmatter.publishedAt)
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
	.map<NewsArticle | null>(([moduleKey, module]) => {
		const validation = validateFrontmatter(moduleKey, module.frontmatter)
		if (!validation.isValid) {
			if (DEV && validation.reason) {
				console.warn(
					`Newsroom article skipped (${moduleKey}): ${validation.reason}`
				)
			}
			return null
		}

		if (!canShowArticle(module.frontmatter ?? {})) {
			return null
		}

		const fileName = getFileName(moduleKey)
		const rawModuleEntry =
			rawArticleModules[moduleKey] ??
			rawArticleModules[`${moduleKey}?raw`] ??
			rawArticleModulesByNormalizedKey.get(moduleKey) ??
			rawArticleModulesByFileName.get(fileName)
		const slug =
			normalizeSlug(module.frontmatter?.slug ?? '') ||
			normalizeSlug(fileName.replace(/\.mdx$/i, ''))

		const sourcePath = toSourcePath(moduleKey)
		const rawContent = getRawArticleSource(rawModuleEntry)
		const componentTextSource = getComponentTextSource(module.default)
		if (DEV && !rawContent && !componentTextSource) {
			console.warn(
				`Newsroom reading time fallback used (${moduleKey}): raw and component sources unavailable, using title+excerpt.`
			)
		}
		const readingTimeSource =
			rawContent ||
			componentTextSource ||
			`${module.frontmatter?.title ?? ''}\n${module.frontmatter?.excerpt ?? ''}`

		const article: NewsArticle = {
			slug,
			title: module.frontmatter?.title?.trim() ?? '',
			excerpt: module.frontmatter?.excerpt?.trim() ?? '',
			publishedAt: module.frontmatter?.publishedAt ?? '',
			...(module.frontmatter?.updatedAt
				? { updatedAt: module.frontmatter.updatedAt }
				: {}),
			category: module.frontmatter?.category?.trim() ?? 'general',
			tags: Array.isArray(module.frontmatter?.tags)
				? module.frontmatter.tags.filter(Boolean)
				: [],
			author: {
				name: module.frontmatter?.author?.name?.trim() ?? '',
				role: module.frontmatter?.author?.role?.trim() ?? '',
				bio: module.frontmatter?.author?.bio,
				avatar: module.frontmatter?.author?.avatar,
				xUrl: module.frontmatter?.author?.xUrl,
				linkedinUrl: module.frontmatter?.author?.linkedinUrl
			},
			coverImage: module.frontmatter?.coverImage,
			thumbnailImage: module.frontmatter?.thumbnailImage,
			draft: Boolean(module.frontmatter?.draft),
			readingTimeMinutes: calculateReadingTimeMinutes(readingTimeSource),
			sourcePath,
			editUrl: toEditUrl(sourcePath),
			Component: module.default
		}

		return article
	})
	.filter((article): article is NewsArticle => article !== null)
	.sort((a, b) => parseDateValue(b.publishedAt) - parseDateValue(a.publishedAt))

export function getNewsArticles(): NewsArticle[] {
	return allArticles
}

export function getNewsArticle(slug: string): NewsArticle | undefined {
	const article = allArticles.find((entry) => entry.slug === slug)
	if (!article) {
		return undefined
	}

	if (!canShowArticle(article)) {
		return undefined
	}

	return article
}

export function getNewsCategories(): string[] {
	return Array.from(
		new Set(allArticles.map((article) => article.category))
	).sort((a, b) => a.localeCompare(b))
}

export function getNewsTags(): string[] {
	const tags = new Set<string>()
	for (const article of allArticles) {
		for (const tag of article.tags) {
			tags.add(tag)
		}
	}

	return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

export function getAdjacentNewsArticles(slug: string): {
	previous?: NewsArticle
	next?: NewsArticle
} {
	const index = allArticles.findIndex((article) => article.slug === slug)
	if (index === -1) {
		return {}
	}

	return {
		previous: allArticles[index + 1],
		next: allArticles[index - 1]
	}
}

export function getRelatedNewsArticles(slug: string, limit = 3): NewsArticle[] {
	const currentArticle = getNewsArticle(slug)
	if (!currentArticle) {
		return []
	}

	const currentTags = new Set(currentArticle.tags)

	return allArticles
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

export function formatNewsDate(dateValue: string): string {
	const parsed = Date.parse(dateValue)
	if (Number.isNaN(parsed)) {
		return dateValue
	}

	return new Intl.DateTimeFormat('en-US', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(new Date(parsed))
}
