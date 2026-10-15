/*
  The canvases that paint with the page's color tokens (the hero stage, its
  backdrop, the dither grain) and the hooks that follow the theme each carried
  their own copy of the pieces below.
*/

/**
 * Resolves a CSS color to sRGB channels in 0..1. The tokens are oklch and
 * color-mix, which only the browser understands, so a 1px 2D canvas paints the
 * color and reads it back.
 */
export function createCssColorProbe(): (
	css: string
) => [number, number, number] {
	const probe = document
		.createElement('canvas')
		.getContext('2d', { willReadFrequently: true })!
	probe.canvas.width = probe.canvas.height = 1

	return (css) => {
		probe.clearRect(0, 0, 1, 1)
		probe.fillStyle = css
		probe.fillRect(0, 0, 1, 1)
		const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
		return [r / 255, g / 255, b / 255]
	}
}

/**
 * Calls `onChange` whenever the theme class on `<html>` changes. Returns the
 * function that stops listening.
 */
export function observeTheme(onChange: () => void): () => void {
	const observer = new MutationObserver(onChange)
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['class']
	})
	return () => observer.disconnect()
}
