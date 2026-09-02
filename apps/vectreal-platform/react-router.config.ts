import { docsPages } from './app/lib/docs/docs-manifest'
import { getNewsPrerenderPaths } from './app/lib/news/news-prerender-paths'

import type { Config } from '@react-router/dev/config'

const DOCS_PRERENDER_PATHS = [
	'/docs',
	...docsPages.map((page) => (page.slug ? `/docs/${page.slug}` : '/docs'))
]

const NEWS_PRERENDER_PATHS = getNewsPrerenderPaths()

const STATIC_PRERENDER_PATHS = [
	'/',
	'/about',
	'/changelog',
	'/code-of-conduct',
	'/privacy-policy',
	'/terms-of-service',
	'/imprint',
	/*
	  `/robots.txt` and `/sitemap.xml` are deliberately absent. One image is
	  built per commit and deployed to both Fly apps, so anything prerendered
	  holds the same bytes on staging and production - which is right for the
	  pages above and wrong for the two documents whose entire job is to tell a
	  crawler which host it is looking at. They render per request and read
	  `APPLICATION_URL`; see `app/lib/deployment-origin.ts`.

	  This makes their cache headers load-bearing for the first time. The
	  prerenderer writes only a resource route's *body* to `build/client/`, so
	  the `Response` headers were discarded and `express.static` answered with
	  its own `max-age=0`. Now the loaders' own `s-maxage` reaches Cloudflare,
	  which is set to `respect_origin` for both paths - the edge serves them and
	  the origin sees one hit a day. It also means a wrong answer sticks for a
	  day and needs a purge, which is why `deployment-origin.ts` fails toward
	  "this is the canonical site" rather than toward `Disallow: /`.
	*/
	...NEWS_PRERENDER_PATHS,
	...DOCS_PRERENDER_PATHS
]

export default {
	ssr: true,
	buildDirectory: '../../build/apps/vectreal-platform',
	prerender: Array.from(new Set(STATIC_PRERENDER_PATHS)),
	routeDiscovery: {
		mode: 'initial'
	},
	splitRouteModules: true
} satisfies Config
