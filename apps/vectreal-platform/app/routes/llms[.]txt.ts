import { docsPages } from '../lib/docs/docs-manifest'
import { getNewsArticles } from '../lib/news/news-manifest'

import type { LoaderFunctionArgs } from 'react-router'

function toAbsolute(origin: string, path: string): string {
	return `${origin}${path}`
}

/**
 * llms.txt endpoint.
 *
 * GEO support for LLM-powered retrieval systems:
 *  - Provides a compact map of canonical, public resources.
 *  - Keeps sensitive routes out of model context ingestion by omission.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const origin = new URL(request.url).origin

	const docsLinks = docsPages.map((page) =>
		toAbsolute(origin, page.slug ? `/docs/${page.slug}` : '/docs')
	)
	const articleLinks = getNewsArticles()
		.filter((article) => !article.draft)
		.map((article) => toAbsolute(origin, `/news-room/${article.slug}`))

	const body = [
		'# Vectreal Platform',
		'',
		'> Open platform for preparing, managing, and publishing 3D content for the web.',
		'',
		'## Canonical',
		`- ${toAbsolute(origin, '/')}`,
		`- ${toAbsolute(origin, '/pricing')}`,
		`- ${toAbsolute(origin, '/docs')}`,
		`- ${toAbsolute(origin, '/news-room')}`,
		'',
		'## Documentation',
		...docsLinks.map((url) => `- ${url}`),
		'',
		'## News',
		...(articleLinks.length > 0
			? articleLinks.map((url) => `- ${url}`)
			: ['- No published news articles yet.']),
		'',
		'## Policies',
		`- ${toAbsolute(origin, '/privacy-policy')}`,
		`- ${toAbsolute(origin, '/terms-of-service')}`,
		`- ${toAbsolute(origin, '/code-of-conduct')}`
	].join('\n')

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control':
				'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
		}
	})
}
