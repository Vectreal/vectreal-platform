import foldPosterUrl from '../../../assets/home/camera-drawing-fold.webp?url'
import sheetPosterUrl from '../../../assets/home/camera-drawing-sheet.webp?url'
import shadowUrl from '../../../assets/home/camera-shadow.webp?url'
import stillFoldUrl from '../../../assets/home/camera-still-fold.webp?url'
import stillSheetUrl from '../../../assets/home/camera-still-sheet.webp?url'

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
		ink: { l: 0.1678, r: 0.842, t: 0.2238, b: 0.7107 }
	},
	fold: {
		url: foldPosterUrl,
		ink: { l: 0.2042, r: 0.8045, t: 0.281, b: 0.7151 }
	}
} as const

export const HERO_SHADOW_URL = shadowUrl

/**
 * The hero as it first shows: the camera rendered, shadow and all, a short
 * orbit short of where it comes to rest, one per framing. It stands from the
 * first paint, and the live stage takes over from it unseen by drawing the
 * same frame. Baked with the posters. Sizes as baked, for the image's box.
 */
export const HERO_STILLS = {
	sheet: { url: stillSheetUrl, width: 1424, height: 1068 },
	fold: { url: stillFoldUrl, width: 1376, height: 1032 }
} as const
