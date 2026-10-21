import {
	AGENT_ACCESS_DESCRIPTION,
	OPEN_SOURCE_PACKAGES,
	PLAN_OFFER_DESCRIPTIONS,
	PLATFORM_SHORT_DESCRIPTION,
	PLATFORM_TAGLINE,
	SUPPORTED_FORMAT_NAMES
} from '../constants/product-copy'
import {
	CONVERT_INDEX_COPY,
	CONVERT_INDEX_PATH,
	CONVERT_PAIRS,
	convertPairPath
} from '../lib/convert/convert-pairs'
import { docsPages } from '../lib/docs/docs-manifest'
import { markdownTwinPath } from '../lib/markdown/markdown-twin'
import { COMMUNITY } from '../lib/navigation/site-map'
import { getNewsArticles } from '../lib/news/news-manifest.server'
import { SITE_URL } from '../lib/seo'

/**
 * llms.txt endpoint.
 *
 * GEO support for LLM-powered retrieval systems. All product claims here are
 * derived from app/constants/product-copy.ts, which is the single source of
 * truth for user-facing claims. Do not add inline claims.
 *
 * Links are on `SITE_URL`, never the request origin: Express runs without
 * `trust proxy`, so behind Fly and Cloudflare it sees `http://`, and staging
 * would hand models a host that is not the product.
 */
export function loader() {
	const origin = SITE_URL

	// The landing page is not a manifest entry (it has no MDX source and no place
	// in the sidebar), but it is where a reader should start.
	const docsLinks = [
		`- [Documentation](${origin}/docs): Guides, package references and operations docs for the Vectreal platform.`,
		// The markdown twin, as the llms.txt convention asks: the HTML page is the
		// same path without `.md`.
		...docsPages.map((page) => {
			const url = `${origin}${markdownTwinPath(`/docs/${page.slug}`)}`
			return `- [${page.title}](${url})${page.description ? ': ' + page.description : ''}`
		})
	]

	const articleLinks = getNewsArticles()
		.filter((article) => !article.draft)
		.map(
			(article) =>
				`- [${article.title}](${origin}${markdownTwinPath(`/news-room/${article.slug}`)}): ${article.excerpt}`
		)

	// Derived from the pair manifest, so a converter that exists is listed and
	// one that does not cannot be.
	const convertLines = [
		`- [${CONVERT_INDEX_COPY.title}](${origin}${CONVERT_INDEX_PATH}): ${CONVERT_INDEX_COPY.description}`,
		...CONVERT_PAIRS.map(
			(pair) =>
				`- [${pair.title}](${origin}${convertPairPath(pair)}): ${pair.description}`
		)
	]

	const packageLines = OPEN_SOURCE_PACKAGES.map(
		(pkg) => `- [${pkg.name}](${pkg.npm}): ${pkg.description}`
	)

	const planLines = Object.entries(PLAN_OFFER_DESCRIPTIONS).map(
		([name, desc]) =>
			`- ${name.charAt(0).toUpperCase() + name.slice(1)}: ${desc}`
	)

	const body = [
		'# Vectreal Platform',
		'',
		`> ${PLATFORM_TAGLINE}`,
		'',
		'## What It Does',
		PLATFORM_SHORT_DESCRIPTION,
		'',
		'## Supported Upload Formats',
		`${SUPPORTED_FORMAT_NAMES.join(', ')}. See [/docs/guides/upload](${origin}/docs/guides/upload) for per-format notes.`,
		'',
		'## Pricing',
		...planLines,
		`- See [/pricing](${origin}/pricing) for current rates.`,
		'',
		'## For AI Agents',
		AGENT_ACCESS_DESCRIPTION,
		`- [Agents and MCP](${origin}${markdownTwinPath('/docs/agents')}): Set up the MCP server in Claude Code, Cursor or VS Code`,
		`- [API Reference](${origin}${markdownTwinPath('/docs/agents/api')}): Endpoints, scopes, Idempotency-Key policy and error codes`,
		'',
		'## Open-Source Packages',
		...packageLines,
		`- [GitHub](${COMMUNITY.github}): Source code and releases`,
		'',
		'## Pages',
		`- [Home](${origin}/): Platform overview, features, and getting started`,
		`- [Pricing](${origin}/pricing): Plan comparison and upgrade`,
		`- [Docs](${origin}/docs): Full platform and package documentation`,
		`- [Newsroom](${origin}/news-room): Product updates and articles`,
		`- [About](${origin}/about): Company information`,
		`- [Contact](${origin}/contact): Support and inquiries`,
		`- [Changelog](${origin}/changelog): Release history`,
		'',
		'## Converters',
		...convertLines,
		'',
		'## Documentation',
		`Every docs page below links its markdown version. All of them in one file: ${origin}/llms-full.txt`,
		'',
		...docsLinks,
		'',
		'## News',
		...(articleLinks.length > 0
			? articleLinks
			: ['- No published news articles yet.']),
		'',
		'## Company',
		'- Operated by: Moritz Becker',
		'- Location: Hamburg, Germany',
		`- Contact: ${origin}/contact`,
		'- GitHub: https://github.com/vectreal',
		'- X: https://x.com/vectreal',
		'',
		'## Policies',
		`- [Privacy Policy](${origin}/privacy-policy)`,
		`- [Terms of Service](${origin}/terms-of-service)`,
		`- [Code of Conduct](${origin}/code-of-conduct)`,
		`- [Imprint](${origin}/imprint)`
	].join('\n')

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control':
				'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
		}
	})
}
