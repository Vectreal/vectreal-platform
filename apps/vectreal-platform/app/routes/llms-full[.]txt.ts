import { docsPages } from '../lib/docs/docs-manifest'
import { getDocMarkdown } from '../lib/markdown/page-markdown.server'
import { SITE_URL } from '../lib/seo'

/**
 * `/llms-full.txt`: every docs page's markdown twin in one document, in the
 * manifest's order, for a reader that wants the whole documentation in one
 * fetch rather than following `/llms.txt` link by link.
 *
 * Each page is headed by the canonical URL it came from, so a model quoting it
 * cites the page rather than this file. On `SITE_URL` rather than the request
 * origin, which is the twins' own: a staging host or the `http://` Express sees
 * behind the proxy would contradict every link inside the pages.
 *
 * Pages are separated by those `Source:` lines alone. A `---` between them
 * would be indistinguishable from the rules the pages themselves contain.
 *
 * `noindex`, like the twins: it is every docs page again in one document.
 */
export function loader() {
	const pages = docsPages.flatMap((page) => {
		const markdown = getDocMarkdown(page.slug)
		return markdown === null
			? []
			: [`Source: ${SITE_URL}/docs/${page.slug}\n\n${markdown.trim()}`]
	})

	const body = [
		'# Vectreal Documentation',
		'',
		`> Every page of the Vectreal docs as markdown. The index is ${SITE_URL}/llms.txt.`,
		'',
		pages.join('\n\n\n'),
		''
	].join('\n')

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Robots-Tag': 'noindex',
			'Cache-Control':
				'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
		}
	})
}
