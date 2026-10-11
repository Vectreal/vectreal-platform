import { CONVERT_INDEX_PATH, convertPairBySlug } from '../convert/convert-pairs'
import {
	PUBLISHER_SAMPLE_PARAM,
	sampleModelById
} from '../samples/sample-models'
import { SITE_URL } from '../seo'

/**
 * Where an article's closing panel sends the reader.
 *
 * The panel used to ask every reader for an account or a look at pricing, right
 * under a body that had just said "Try it, no account needed". Each article now
 * names its own next step in `cta:`, and the panel asks for that one thing.
 */
export type ArticleCtaKind = 'publisher' | 'convert'

export interface ArticleCta {
	kind: ArticleCtaKind
	/** Same-origin path, with the query the author wrote, ready for `<Link to>`. */
	to: string
}

const PUBLISHER_PATH = '/publisher'

/** An article without `cta:` ends on the publisher, as every article body did before the field existed. */
export const DEFAULT_ARTICLE_CTA: ArticleCta = {
	kind: 'publisher',
	to: PUBLISHER_PATH
}

/**
 * Reads the `cta:` URL an author wrote, absolute on vectreal.com or a path,
 * as one of the destinations the panel knows how to present: the publisher,
 * optionally naming a sample, or the converters, optionally naming a pair.
 *
 * Returns null for anything else, including a sample or pair that does not
 * exist, which the manifest treats as invalid frontmatter: a typo'd URL must
 * not ship as the article's only call to action.
 */
export function resolveArticleCta(
	value: string | undefined
): ArticleCta | null {
	if (value === undefined) return DEFAULT_ARTICLE_CTA
	if (!URL.canParse(value, SITE_URL)) return null

	const url = new URL(value, SITE_URL)
	if (url.origin !== SITE_URL) return null

	const to = `${url.pathname}${url.search}`
	const params = [...url.searchParams.keys()]

	if (url.pathname === PUBLISHER_PATH) {
		if (params.length === 0) return { kind: 'publisher', to }
		const sample = url.searchParams.get(PUBLISHER_SAMPLE_PARAM)
		const onlySample =
			params.length === 1 && params[0] === PUBLISHER_SAMPLE_PARAM
		return onlySample && sampleModelById(sample ?? '')
			? { kind: 'publisher', to }
			: null
	}

	if (params.length > 0) return null
	if (url.pathname === CONVERT_INDEX_PATH) return { kind: 'convert', to }

	const [, section, slug, ...rest] = url.pathname.split('/')
	if (`/${section}` === CONVERT_INDEX_PATH && rest.length === 0) {
		return convertPairBySlug(slug) ? { kind: 'convert', to } : null
	}

	return null
}
