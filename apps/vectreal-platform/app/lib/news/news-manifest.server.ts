import { isValidElement } from 'react'

import { resolveArticleCta } from './article-cta'
import { normalizeSlug } from '../utils/slug'

import type { NewsArticle, NewsArticleFrontmatter } from './news-article'
import type { ComponentType, ReactNode } from 'react'

const GITHUB_REPO = 'https://github.com/Vectreal/vectreal-platform'
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

		const cta = resolveArticleCta(frontmatter?.cta)
		if (!cta) {
			if (DEV) {
				console.warn(
					`Newsroom article skipped (${moduleKey}): cta must be a vectreal.com /publisher, /convert or /view URL.`
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
