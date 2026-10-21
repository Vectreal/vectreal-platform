import { z } from 'zod'

import { defineOperation, type OperationContext } from './operation'

export interface DocPage {
	slug: string
	title: string
	url: string
	markdown: string
}

/**
 * The pages of `/llms-full.txt`. The file heads each page with a
 * `Source: <url>` line and separates them with nothing else, since a `---`
 * would match the rules inside the pages.
 */
export function parseDocPages(text: string): DocPage[] {
	const parts = text.split(/^Source: (\S+)$/m)
	const pages: DocPage[] = []
	for (let i = 1; i < parts.length; i += 2) {
		const url = parts[i]
		const markdown = parts[i + 1].trim()
		const slug = new URL(url).pathname.replace(/^\/docs\//, '')
		const title = /^#\s+(.+)$/m.exec(markdown)?.[1].trim() ?? slug
		pages.push({ slug, title, url, markdown })
	}
	return pages
}

const occurrences = (haystack: string, needle: string) =>
	haystack.split(needle).length - 1

/**
 * The pages that mention the query's words most, a title match counting more
 * than one in the text. Plain term counting: the docs are a few dozen pages,
 * and an agent reads the page it picks with `read_doc`.
 */
export function searchDocPages(pages: DocPage[], query: string, limit: number) {
	const terms = query
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((term) => term.length > 1)
	return pages
		.map((page) => {
			const title = page.title.toLowerCase()
			const text = page.markdown.toLowerCase()
			const score = terms.reduce(
				(sum, term) =>
					sum + occurrences(title, term) * 5 + occurrences(text, term),
				0
			)
			const first = Math.min(
				...terms.map((term) => text.indexOf(term)).filter((at) => at >= 0)
			)
			const start = Number.isFinite(first) ? Math.max(0, first - 120) : 0
			return {
				slug: page.slug,
				title: page.title,
				url: page.url,
				excerpt: page.markdown.slice(start, start + 360).trim(),
				score
			}
		})
		.filter((result) => result.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
}

async function fetchText(context: OperationContext, path: string) {
	const response = await context.fetch(new URL(path, context.origin))
	if (!response.ok) {
		throw new Error(`${path} answered ${response.status}.`)
	}
	return response.text()
}

export const searchDocs = defineOperation({
	name: 'search_docs',
	title: 'Search the Vectreal docs',
	description:
		'Finds the Vectreal documentation pages that best match a query, with an excerpt of each. Read a whole page with read_doc. Needs no sign-in.',
	input: z.object({
		query: z.string().trim().min(1).describe('What to look for.'),
		limit: z.number().int().min(1).max(20).default(5)
	}),
	readOnly: true,
	destructive: false,
	run: async ({ query, limit }, context) => ({
		results: searchDocPages(
			parseDocPages(await fetchText(context, '/llms-full.txt')),
			query,
			limit
		)
	})
})

export const readDoc = defineOperation({
	name: 'read_doc',
	title: 'Read a Vectreal docs page',
	description:
		'One Vectreal documentation page as markdown, by the slug search_docs answers with (such as "getting-started"). Needs no sign-in.',
	input: z.object({
		slug: z
			.string()
			.trim()
			.regex(/^[a-z0-9][a-z0-9/-]*$/, 'A docs slug, such as getting-started.')
	}),
	readOnly: true,
	destructive: false,
	run: async ({ slug }, context) => ({
		slug,
		markdown: await fetchText(context, `/docs/${slug}.md`)
	})
})
