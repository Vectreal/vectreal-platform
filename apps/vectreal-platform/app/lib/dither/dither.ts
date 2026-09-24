/**
 * The home page's one texture: an ordered (Bayer) dither in cells of two CSS
 * pixels.
 *
 * It is how the page fades anything out. The hero's model dissolves toward the
 * copy with it, the canvas bounds dissolve with it, the backdrop's grain and
 * light are printed in it, and the product window changes views through it.
 * One matrix and one cell size, so every one of those reads as the same
 * material; this module is where both live, for the shaders and for CSS alike.
 *
 * An ordered dither is a threshold: a cell is on when the value it stands for
 * exceeds its place in the matrix. That is what lets CSS do it without a
 * canvas, as a precomputed mask.
 */

/** Row-major, values 0 to 15. */
export const BAYER_4 = [
	0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5
] as const

/** Edge of one dither cell, in CSS pixels. */
export const DITHER_CELL_PX = 2

/** The matrix as GLSL (ES 3.0), for any shader that dithers. Takes a cell index. */
export const BAYER4_GLSL = /* glsl */ `
float bayer4(vec2 p){
  ivec2 i = ivec2(mod(p, 4.0));
  int m[16] = int[](${BAYER_4.join(', ')});
  return (float(m[i.y * 4 + i.x]) + 0.5) / 16.0;
}`

const threshold = (x: number, y: number) =>
	(BAYER_4[(y % 4) * 4 + (x % 4)] + 0.5) / 16

const svgUrl = (width: number, height: number, cells: string) =>
	`url("data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' shape-rendering='crispEdges'>${cells}</svg>`
	)}")`

const cell = (x: number, y: number) =>
	`<rect x='${x * DITHER_CELL_PX}' y='${y * DITHER_CELL_PX}' width='${DITHER_CELL_PX}' height='${DITHER_CELL_PX}'/>`

/**
 * A vertical band that dithers from fully shown at the top to gone at the
 * bottom, as a CSS mask tile one matrix wide, to repeat along x.
 *
 * Masking the last `heightPx` of a surface with it makes that edge dissolve
 * into whatever lies behind, the way the hero's canvas meets its frame.
 */
export function ditherFadeDownMask(heightPx: number): string {
	const rows = Math.round(heightPx / DITHER_CELL_PX)
	let cells = ''
	for (let y = 0; y < rows; y++) {
		const e = 1 - (y + 0.5) / rows
		const kept = e * e * (3 - 2 * e) // smoothstep, as the shaders fade
		for (let x = 0; x < 4; x++) if (threshold(x, y) < kept) cells += cell(x, y)
	}
	return svgUrl(4 * DITHER_CELL_PX, heightPx, cells)
}

/**
 * The seventeen states of a dissolve: frame `k` shows `k` of the matrix's
 * sixteen cells. Stepping a mask through them turns one surface into another
 * through the dither rather than a crossfade.
 */
export const DITHER_DISSOLVE_FRAMES: readonly string[] = Array.from(
	{ length: 17 },
	(_, k) => {
		let cells = ''
		for (let y = 0; y < 4; y++)
			for (let x = 0; x < 4; x++)
				if (BAYER_4[y * 4 + x] < k) cells += cell(x, y)
		return svgUrl(4 * DITHER_CELL_PX, 4 * DITHER_CELL_PX, cells)
	}
)

/**
 * Dissolves an element in through the matrix: its mask steps through the
 * seventeen frames over `ms`, then is cleared. Returns a cancel that also
 * clears the mask, for a switch that lands mid-dissolve or an unmount.
 */
export function dissolveIn(
	el: HTMLElement,
	ms: number,
	onDone?: () => void
): () => void {
	let raf = 0
	const t0 = performance.now()
	el.style.maskSize = `${4 * DITHER_CELL_PX}px ${4 * DITHER_CELL_PX}px`
	el.style.maskImage = DITHER_DISSOLVE_FRAMES[0]
	const clear = () => {
		el.style.removeProperty('mask-image')
		el.style.removeProperty('mask-size')
	}
	const step = (t: number) => {
		const k = Math.min(Math.floor(((t - t0) / ms) * 16), 16)
		el.style.maskImage = DITHER_DISSOLVE_FRAMES[k]
		if (k < 16) raf = requestAnimationFrame(step)
		else {
			clear()
			onDone?.()
		}
	}
	raf = requestAnimationFrame(step)
	return () => {
		cancelAnimationFrame(raf)
		clear()
	}
}
