/**
 * Shared-element names for the featured-card ⇄ article-hero morph.
 *
 * The listing's featured block and the article header are the same composition
 * at two sizes, so the navigation between them is a resize rather than a page
 * change. Naming the matching parts on both sides lets the browser tween them.
 *
 * Every name is scoped to the slug, which is what keeps the morph honest: the
 * pairing only fires when the card you clicked is the article you land on.
 * Click any other row and the names on the two pages simply do not match, so
 * the browser falls back to the plain root cross-fade with no extra logic.
 *
 * The alternative - static names gated by `useViewTransitionState` - only works
 * one way. That hook is true only on the page owning the clicked link, so the
 * return trip from "Back to Newsroom" would find no name on the listing side.
 *
 * Every visible layer needs a name, not just the ones worth animating. Unnamed
 * descendants are flattened into their nearest named ancestor's snapshot, and
 * sibling groups paint in capture order - so the copy, which paints above the
 * scene in the live page, would paint *under* the scene mid-flight and vanish.
 *
 * Slugs are `[a-z0-9-]+` (see `normalizeSlug`), so every name is a valid CSS
 * custom-ident.
 */
export function newsroomMorphNames(slug: string) {
	return {
		/** The card surface: background, hairline border, radius. */
		card: `news-card-${slug}`,
		/** The generated scene artwork, identical on both sides. */
		scene: `news-scene-${slug}`,
		/** The gradient that the copy sits on. */
		scrim: `news-scrim-${slug}`,
		eyebrow: `news-eyebrow-${slug}`,
		title: `news-title-${slug}`,
		/**
		 * Listing only, and deliberately so. The article page does carry the same
		 * excerpt, but below the hero rather than inside it - pairing the two made
		 * the line fly the length of the card while cross-fading between a clamped
		 * two-line version and the full one, which read as a smear. Left unpaired
		 * it simply fades where it sits. It still needs a name: unnamed copy would
		 * be folded into the card's snapshot and paint *under* the scene image
		 * mid-flight, so it would blink out rather than fade.
		 */
		excerpt: `news-excerpt-${slug}`,
		meta: `news-meta-${slug}`
	} as const
}

export type NewsroomMorphNames = ReturnType<typeof newsroomMorphNames>
