import { useEffect, type RefObject } from 'react'

import { paintEdgeFill, planEdgeFill } from '../components/thumbnail-edge-bands'

/**
 * Past this ratio a blurred fill gains nothing, and a large viewer on a dense
 * display would otherwise ask for a canvas past the browser's area limit.
 */
const MAX_PIXEL_RATIO = 2

/**
 * Keeps `canvas` filled with the bands a contained `image` leaves, repainted
 * when the image loads and whenever the canvas changes size.
 *
 * The canvas is sized from its layout box, which a CSS transform does not
 * change, so it can carry the image's own scale and blur and stay aligned.
 * `src` only re-runs the fill, so a new thumbnail never shows the old one's
 * bands while it loads.
 */
export function useThumbnailEdgeBands(
	canvasRef: RefObject<HTMLCanvasElement | null>,
	imageRef: RefObject<HTMLImageElement | null>,
	enabled: boolean,
	src: string
): void {
	useEffect(() => {
		const canvas = canvasRef.current
		const image = imageRef.current
		if (!enabled || !canvas || !image) return
		const context = canvas.getContext('2d')
		if (!context) return

		const paint = () => {
			const ready = image.complete && image.naturalWidth > 0
			const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
			const width = Math.round(canvas.clientWidth * ratio)
			const height = Math.round(canvas.clientHeight * ratio)
			if (canvas.width !== width) canvas.width = width
			if (canvas.height !== height) canvas.height = height
			paintEdgeFill(
				context,
				image,
				ready
					? planEdgeFill(
							{ width, height },
							{ width: image.naturalWidth, height: image.naturalHeight }
						)
					: []
			)
		}

		// A cached image can be complete before this effect runs, so its `load`
		// has already fired.
		paint()
		image.addEventListener('load', paint)
		const observer =
			typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(paint)
		observer?.observe(canvas)

		return () => {
			image.removeEventListener('load', paint)
			observer?.disconnect()
		}
	}, [canvasRef, imageRef, enabled, src])
}
