import foldPosterUrl from '../../../assets/home/camera-drawing-fold.webp?url'
import sheetPosterUrl from '../../../assets/home/camera-drawing-sheet.webp?url'
import shadowUrl from '../../../assets/home/camera-shadow.webp?url'

/**
 * The hero model's baked assets. `scripts/bake-home-hero.ts` regenerates all of
 * them from the running page, so they always match the stage that draws live.
 *
 * The posters are the model's front elevation as line coverage (alpha only):
 * the page uses them as masks filled with the ink color, so one file serves
 * both themes. There is one per framing, because the wide sheet and the folded
 * card frame the model differently. `ink` is where the lines lie inside each,
 * as fractions of the frame, measured at bake: the plot travels only across
 * the drawing, so every byte that arrives uncovers some of it.
 *
 * The shadow is the directional bake as a density image, so the stage shows
 * a soft shadow on arrival without baking one.
 */
export const HERO_POSTERS = {
	sheet: {
		url: sheetPosterUrl,
		ink: { l: 0.1684, r: 0.8411, t: 0.2246, b: 0.7097 }
	},
	fold: {
		url: foldPosterUrl,
		ink: { l: 0.2037, r: 0.8044, t: 0.2828, b: 0.7153 }
	}
} as const

export const HERO_SHADOW_URL = shadowUrl
