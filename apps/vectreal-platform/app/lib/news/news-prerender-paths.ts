import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeSlug } from '../content/slug'

const NEWS_INDEX_PATH = '/news-room'
const NEWS_ARTICLES_DIRECTORY = fileURLToPath(
	new URL('../../routes/news-room-page/articles', import.meta.url)
)

function getFrontmatterBlock(content: string): string {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
	return match?.[1] ?? ''
}

function isDraftArticle(frontmatter: string): boolean {
	const draftMatch = frontmatter.match(/^draft:\s*(true|false)\s*$/m)
	return draftMatch?.[1] === 'true'
}

function getFrontmatterSlug(frontmatter: string): string | undefined {
	const slugMatch = frontmatter.match(/^slug:\s*['\"]?([^'\"\n]+)['\"]?\s*$/m)
	if (!slugMatch?.[1]) {
		return undefined
	}

	const normalizedSlug = normalizeSlug(slugMatch[1])
	return normalizedSlug || undefined
}

export function getNewsPrerenderPaths(): string[] {
	let articleFiles: string[] = []

	try {
		articleFiles = readdirSync(NEWS_ARTICLES_DIRECTORY).filter((fileName) =>
			/\.mdx?$/i.test(fileName)
		)
	} catch {
		return [NEWS_INDEX_PATH]
	}

	const articlePaths = articleFiles
		.map((fileName) => {
			const filePath = join(NEWS_ARTICLES_DIRECTORY, fileName)
			const source = readFileSync(filePath, 'utf8')
			const frontmatter = getFrontmatterBlock(source)

			if (isDraftArticle(frontmatter)) {
				return null
			}

			const slug =
				getFrontmatterSlug(frontmatter) ||
				normalizeSlug(fileName.replace(/\.mdx?$/i, ''))

			if (!slug) {
				return null
			}

			return `${NEWS_INDEX_PATH}/${slug}`
		})
		.filter((path): path is string => path !== null)

	return [NEWS_INDEX_PATH, ...articlePaths]
}
