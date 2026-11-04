/**
 * The bands around a contained loading thumbnail, filled from the thumbnail.
 *
 * Contained, a 16:9 thumbnail leaves bands on any other viewport, and nothing
 * else is there to fill them at first paint: the viewer paints the scene's
 * stage only once its settings load. Each band is the image's own edge row
 * (or column) stretched across it, so whatever the stage is (a color, a
 * gradient, an HDRI) the band continues it without a seam. Where the model
 * crosses the image's edge, it smears into the band; that is accepted.
 *
 * The fill also carries the image itself under the real one. Both are blurred,
 * and a band that stopped at the image's edge would fade there just as the
 * image's own edge fades, leaving a dark line of page between them.
 *
 * Painted by scaling with `drawImage` and never read back, so a cross-origin
 * thumbnail cannot make the fill fail: at worst it taints a canvas nobody
 * reads.
 */

export interface Size {
	width: number
	height: number
}

/** One draw of the fill: a part of the image, and where it is stretched to. */
export interface FillDraw {
	/** `[sx, sy, sw, sh]` in image pixels. */
	source: [number, number, number, number]
	/** `[dx, dy, dw, dh]` in canvas pixels. */
	target: [number, number, number, number]
}

/** Bands narrower than this leave nothing visible to fill. */
const MIN_BAND = 0.5

/**
 * How far each band reaches under the image, in canvas pixels, so no hairline
 * shows where the edge lands between pixels.
 */
const SEAM_OVERLAP = 1

/**
 * What fills the bands `object-fit: contain` leaves when an `image` sized
 * image is shown in a `box`, both in canvas pixels: the image at its contained
 * place, then its edge rows stretched above and below on a viewport narrower
 * than the image, or its edge columns left and right on a wider one. Nothing
 * at its own aspect, where there are no bands.
 */
export function planEdgeFill(box: Size, image: Size): FillDraw[] {
	if (box.width <= 0 || box.height <= 0) return []
	if (image.width <= 0 || image.height <= 0) return []

	// Whole canvas pixels: a clip with a fractional edge antialiases, and the
	// squaring pass would then thin one row of the seam into a visible line.
	// Under the blur, half a pixel off the real image's edge does not show.
	const scale = Math.min(box.width / image.width, box.height / image.height)
	const left = Math.round((box.width - image.width * scale) / 2)
	const top = Math.round((box.height - image.height * scale) / 2)
	const width = box.width - 2 * left
	const height = box.height - 2 * top
	const body: FillDraw = {
		source: [0, 0, image.width, image.height],
		target: [left, top, width, height]
	}

	if (top >= MIN_BAND) {
		return [
			body,
			{
				source: [0, 0, image.width, 1],
				target: [left, 0, width, top + SEAM_OVERLAP]
			},
			{
				source: [0, image.height - 1, image.width, 1],
				target: [
					left,
					top + height - SEAM_OVERLAP,
					width,
					box.height - top - height + SEAM_OVERLAP
				]
			}
		]
	}

	if (left >= MIN_BAND) {
		return [
			body,
			{
				source: [0, 0, 1, image.height],
				target: [0, top, left + SEAM_OVERLAP, height]
			},
			{
				source: [image.width - 1, 0, 1, image.height],
				target: [
					left + width - SEAM_OVERLAP,
					top,
					box.width - left - width + SEAM_OVERLAP,
					height
				]
			}
		]
	}

	return []
}

/**
 * How many times each draw's alpha is squared. A stageless thumbnail is
 * transparent around the model, except where its ground shadow reaches the
 * edge at a few percent of opacity, and stretched across a phone's band that
 * faint row reads as a grey slab. Squaring twice takes alpha to its fourth
 * power: 0.18 falls to 0.001, while a stage, opaque everywhere, keeps 1. It
 * also keeps the copy under the real image from darkening that shadow.
 */
const ALPHA_SQUARINGS = 2

/** Paints `draws` of `image` onto `context`, clearing whatever was there. */
export function paintEdgeFill(
	context: CanvasRenderingContext2D,
	image: CanvasImageSource,
	draws: readonly FillDraw[]
): void {
	const { canvas } = context
	context.clearRect(0, 0, canvas.width, canvas.height)

	for (const { source, target } of draws) {
		context.drawImage(image, ...source, ...target)
		// Drawing the same pixels `destination-in` multiplies each pixel's alpha
		// by itself and leaves its color, so only faint alpha is lost. Clipped to
		// the draw, because `destination-in` clears everything it does not cover.
		context.save()
		context.beginPath()
		context.rect(...target)
		context.clip()
		context.globalCompositeOperation = 'destination-in'
		for (let pass = 0; pass < ALPHA_SQUARINGS; pass++) {
			context.drawImage(image, ...source, ...target)
		}
		context.restore()
	}
}
