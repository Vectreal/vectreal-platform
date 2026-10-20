import { CONVERT_INDEX_COPY, CONVERT_PAIRS } from './convert/convert-pairs'
import { PUBLIC_SEO_PAGES } from './seo-registry'
import { SHARE_CARD_SIZE, shareCardImagePath } from './share-card-paths'
import { MODEL_INTAKE_COPY, PRICING_PAGE_COPY } from '../constants/product-copy'

/**
 * The link previews a shared page shows: one default card, and cards for the
 * pages people share on their own. `scripts/bake-share-cards.ts` draws them;
 * the routes point their `og:image` here.
 *
 * Every line on a card is read from the page's own copy, never written for the
 * card, so a card says what its page says. A baked card can still fall behind
 * its page when the copy changes after the bake: `share-cards.spec.ts` holds
 * each card's text against what it was baked from and fails until it is baked
 * again.
 */
export interface ShareCard {
	slug: string
	/** The page's name, above the caption. Absent on a card that is about the whole site. */
	eyebrow?: string
	caption: string
}

/** A page title without the site's name: `Pricing - Vectreal` reads `Pricing`. */
function pageName(title: string): string {
	return title.replace(/^Vectreal - /, '').replace(/ - Vectreal.*$/, '')
}

export const SHARE_CARDS = [
	{ slug: 'default', caption: pageName(PUBLIC_SEO_PAGES.home.title) },
	{
		slug: 'pricing',
		eyebrow: pageName(PUBLIC_SEO_PAGES.pricing.title),
		caption: PRICING_PAGE_COPY.heading
	},
	// One per language the page is served in, since the card carries its title.
	...Object.entries(MODEL_INTAKE_COPY).map(([locale, copy]) => ({
		slug: `free-model-${locale}`,
		caption: pageName(copy.meta.title)
	})),
	{
		slug: 'docs',
		eyebrow: pageName(PUBLIC_SEO_PAGES.docs.title),
		caption: PUBLIC_SEO_PAGES.docs.description
	},
	{ slug: 'converters', caption: CONVERT_INDEX_COPY.title },
	...CONVERT_PAIRS.map((pair) => ({
		slug: convertShareCardSlug(pair.slug),
		caption: pair.title
	}))
] satisfies ShareCard[]

export function convertShareCardSlug(pairSlug: string): string {
	return `convert-${pairSlug}`
}

/** A card's fields for `buildPageMeta`. */
export function shareCardMeta(slug: string) {
	const card = SHARE_CARDS.find((one) => one.slug === slug)
	if (!card) throw new Error(`No share card "${slug}"`)

	return {
		image: shareCardImagePath(card.slug),
		imageAlt: card.caption,
		imageWidth: SHARE_CARD_SIZE.width,
		imageHeight: SHARE_CARD_SIZE.height
	}
}
