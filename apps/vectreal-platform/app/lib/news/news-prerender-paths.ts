import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeSlug } from '../utils/slug'

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

/**
 * Every article page to prerender, scheduled ones included: the prerendered
 * files are the same on staging, which shows a scheduled article early, and on
 * production, where `server.mjs` withholds them until `publishedAt`
 * (`news-schedule.ts`). Drafts are left out.
 *
 * `/news-room` itself is not here. It renders per request, so an article
 * appears in it once live without a deploy; prerendered, it would also have
 * listed every scheduled article on production from the day of the build.
 */
export function getNewsPrerenderPaths(
	directory = NEWS_ARTICLES_DIRECTORY
): string[] {
	let articleFiles: string[] = []

	try {
		articleFiles = readdirSync(directory).filter((fileName) =>
			/\.mdx?$/i.test(fileName)
		)
	} catch {
		return []
	}

	return articleFiles
		.map((fileName) => {
			const filePath = join(directory, fileName)
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
}
