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
	'/contact',
	'/code-of-conduct',
	'/privacy-policy',
	'/terms-of-service',
	'/imprint',
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

	future: {
		v8_viteEnvironmentApi: true,
		v8_middleware: true
	}
} satisfies Config
