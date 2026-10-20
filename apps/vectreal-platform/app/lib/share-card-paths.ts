/**
 * Where a baked share card lives and how large it is. Apart from the card
 * definitions in `share-cards.ts` because `seo.ts` needs the default card's
 * address, and the definitions read the page copy that `seo-registry.ts` builds
 * on `seo.ts`: importing them from here would close that loop.
 */
export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const

export function shareCardImagePath(slug: string): string {
	return `/media/images/share/${slug}.png`
}
