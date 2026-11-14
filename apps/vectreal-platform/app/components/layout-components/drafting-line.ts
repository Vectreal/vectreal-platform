/**
 * The drafting grid's line, one owner for every floor that draws it: the page
 * backdrop behind the heads and bands, and the floor in the home hero's scene.
 * Same weight and same ink, so the hero's floor reads as the page's.
 */
export const DRAFTING_LINE = {
	/** In CSS pixels: a hairline, so the net stays a texture rather than a pattern. */
	width: 0.5,
	/** The ink's alpha, by the ground it lies on: light ink on a dark ground needs a little more. */
	alpha: { light: 0.26, dark: 0.34 }
} as const
