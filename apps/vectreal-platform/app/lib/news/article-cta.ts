import { CONVERT_INDEX_PATH, convertPairBySlug } from '../convert/convert-pairs'
import {
	exampleSceneById,
	PUBLISHER_EXAMPLE_PARAM
} from '../samples/example-scenes'
import {
	PUBLISHER_SAMPLE_PARAM,
	sampleModelById
} from '../samples/sample-models'
import { SITE_URL } from '../seo'
import { VIEW_PAGE_PATH } from '../view/view-page-copy'

/**
 * Where an article's closing panel sends the reader.
 *
 * The panel used to ask every reader for an account or a look at pricing, right
 * under a body that had just said "Try it, no account needed". Each article now
 * names its own next step in `cta:`, and the panel asks for that one thing.
 *
 * A publisher ask also carries one model to open straight away: the example
 * the article showed, or a sample. The panel offers it as a shortcut beside the
 * main button, so a reader with nothing to hand still has a first step.
 */
export type ArticleCta =
	| { kind: 'publisher'; shortcut: ArticleCtaShortcut }
	/** `to` is a same-origin path, ready for `<Link to>`. */
	| { kind: 'convert'; to: string }
	| { kind: 'view' }

export interface ArticleCtaShortcut {
	type: 'sample' | 'example'
	id: string
}

const PUBLISHER_PATH = '/publisher'

/**
 * An article without `cta:` ends on the publisher, as every article body did
 * before the field existed. The rocket is the sample offered, being the one
 * under a megabyte.
 */
export const DEFAULT_ARTICLE_CTA: ArticleCta = {
	kind: 'publisher',
	shortcut: { type: 'sample', id: 'rocket' }
}

/**
 * Reads the `cta:` URL an author wrote, absolute on vectreal.com or a path,
 * as one of the destinations the panel knows how to present: the publisher,
 * optionally naming a sample or an example scene, the converters,
 * optionally naming a pair, or the viewer.
 *
 * Returns null for anything else, including a sample, example or pair that
 * does not exist, which the manifest treats as invalid frontmatter: a typo'd
 * URL must not ship as the article's only call to action.
 */
export function resolveArticleCta(
	value: string | undefined
): ArticleCta | null {
	if (value === undefined) return DEFAULT_ARTICLE_CTA

	// Not `URL.canParse`: this runs in the client bundle, and Safari before 17 lacks it.
	let url: URL
	try {
		url = new URL(value, SITE_URL)
	} catch {
		return null
	}
	if (url.origin !== SITE_URL) return null

	const params = [...url.searchParams.entries()]

	if (url.pathname === PUBLISHER_PATH) {
		if (params.length === 0) return DEFAULT_ARTICLE_CTA
		if (params.length !== 1) return null

		const [[name, id]] = params
		if (name === PUBLISHER_SAMPLE_PARAM && sampleModelById(id)) {
			return { kind: 'publisher', shortcut: { type: 'sample', id } }
		}
		if (name === PUBLISHER_EXAMPLE_PARAM && exampleSceneById(id)) {
			return { kind: 'publisher', shortcut: { type: 'example', id } }
		}
		return null
	}

	if (params.length > 0) return null

	const to = url.pathname
	if (to === VIEW_PAGE_PATH) return { kind: 'view' }
	if (to === CONVERT_INDEX_PATH) return { kind: 'convert', to }

	const [, section, slug, ...rest] = to.split('/')
	if (`/${section}` === CONVERT_INDEX_PATH && rest.length === 0) {
		return convertPairBySlug(slug) ? { kind: 'convert', to } : null
	}

	return null
}
