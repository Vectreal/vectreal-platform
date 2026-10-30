import {
	getArticleMarkdown,
	getDocMarkdown
} from '../lib/markdown/page-markdown.server'
import { SITE_URL } from '../lib/seo'

import type { LoaderFunctionArgs } from 'react-router'

/**
 * `/docs/{slug}.md` and `/news-room/{slug}.md`: the page as markdown, for a
 * chat or coding agent to read. `routes.tsx` registers one route per page, from
 * the same manifests the prerender list uses.
 *
 * Rendered per request rather than prerendered: the prerenderer keeps only a
 * resource route's body, and this one's headers are the point. `noindex` and the
 * canonical link keep a search engine on the HTML page instead of indexing a
 * second copy of it. The markdown is already in memory, so a request costs
 * nothing.
 */
export function loader({ request }: LoaderFunctionArgs) {
	const htmlPath = new URL(request.url).pathname.replace(/\.md\/?$/, '')
	const markdown = htmlPath.startsWith('/docs/')
		? getDocMarkdown(htmlPath.slice('/docs/'.length))
		: getArticleMarkdown(htmlPath.slice('/news-room/'.length))

	/*
	  `no-store`, because Cloudflare respects this path's origin headers and
	  caches a 404 that has none for minutes. The twin of a scheduled article is
	  a 404 on production until its `publishedAt`, and must stop being one then.
	*/
	if (markdown === null) {
		throw new Response('Not found', {
			status: 404,
			headers: { 'Cache-Control': 'no-store' }
		})
	}

	return new Response(markdown, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'X-Robots-Tag': 'noindex',
			Link: `<${SITE_URL}${htmlPath}>; rel="canonical"`,
			'Cache-Control':
				'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
		}
	})
}
