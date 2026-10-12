import { getDocPage } from '../docs/docs-manifest'
import { getNewsArticle } from '../news/news-manifest.server'

/*
  Every docs page and article as markdown, through `mdx-markdown-plugin.ts`.
  `.server`, so no twin reaches a browser bundle: the client fetches one by URL.

  Keyed by repo-relative path, the form `docsPages` and the news manifest both
  carry as `sourcePath`.
*/
const twins = {
	...import.meta.glob<string>('../../routes/docs/**/*.mdx', {
		query: '?markdown',
		import: 'default',
		eager: true
	}),
	...import.meta.glob<string>('../../routes/news-room-page/articles/*.mdx', {
		query: '?markdown',
		import: 'default',
		eager: true
	})
}

const twinsBySourcePath = new Map(
	Object.entries(twins).map(([moduleKey, markdown]) => [
		`apps/vectreal-platform/app/${moduleKey.replace(/^(\.\.\/)+/, '')}`,
		markdown
	])
)

/** The markdown of the docs page at `/docs/{slug}`, or null. */
export function getDocMarkdown(slug: string): string | null {
	const page = getDocPage(slug)
	return page ? (twinsBySourcePath.get(page.sourcePath) ?? null) : null
}

/**
 * The markdown of the article at `/news-room/{slug}`, or null, including for a
 * draft outside dev, which `getNewsArticle` already withholds.
 *
 * An article's title and standfirst live in frontmatter rather than the body,
 * so they are put back on top here, from the manifest that renders them.
 */
export function getArticleMarkdown(slug: string): string | null {
	const article = getNewsArticle(slug)
	const body = article ? twinsBySourcePath.get(article.sourcePath) : undefined
	if (!article || body === undefined) return null
	return `# ${article.title}\n\n${article.excerpt}\n\n${body}`
}
