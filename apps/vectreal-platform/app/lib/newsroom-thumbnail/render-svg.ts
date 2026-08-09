import { PALETTE } from './palette'

import type { Segment, Viewport } from './projection'

export interface RenderSvgOptions {
	viewport: Viewport
	/** Emit an opaque background rect. On for baked images, off for the hero. */
	background?: boolean
	/** Opacity quantization levels per color. */
	buckets?: number
}

const DEFAULT_BUCKETS = 8

/**
 * Segments to SVG.
 *
 * Thousands of individual <line> elements would be both enormous and slow to
 * parse, so opacity is quantized into a few buckets and each bucket becomes a
 * single <path>. Coordinates are rounded to integers: the viewBox is large
 * enough that the precision loss is invisible and it roughly halves the bytes.
 */
export function renderSvg(
	segments: Segment[],
	options: RenderSvgOptions
): string {
	const { viewport } = options
	const buckets = options.buckets ?? DEFAULT_BUCKETS

	const lineBuckets: string[][] = Array.from({ length: buckets }, () => [])
	const accentBuckets: string[][] = Array.from({ length: buckets }, () => [])

	for (const segment of segments) {
		const level = Math.min(
			buckets - 1,
			Math.max(0, Math.round(segment.opacity * (buckets - 1)))
		)
		const target = segment.accent ? accentBuckets : lineBuckets

		target[level].push(
			`M${Math.round(segment.x1)} ${Math.round(segment.y1)}L${Math.round(segment.x2)} ${Math.round(segment.y2)}`
		)
	}

	const paths: string[] = []

	const emit = (
		collected: string[][],
		color: string,
		alphaScale: number,
		width: number
	) => {
		collected.forEach((commands, level) => {
			if (commands.length === 0) {
				return
			}

			const opacity = ((level / (buckets - 1)) * alphaScale).toFixed(3)
			paths.push(
				`<path d="${commands.join('')}" stroke="rgba(${color}, ${opacity})" stroke-width="${width}" fill="none" stroke-linecap="round"/>`
			)
		})
	}

	emit(lineBuckets, PALETTE.line, PALETTE.lineAlpha, 0.55)
	emit(accentBuckets, PALETTE.accent, PALETTE.accentAlpha, 0.7)

	const background = options.background
		? `<rect width="${viewport.width}" height="${viewport.height}" fill="${PALETTE.background}"/>`
		: ''

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewport.width} ${viewport.height}" width="${viewport.width}" height="${viewport.height}" preserveAspectRatio="xMidYMid slice">${background}${paths.join('')}</svg>`
}
