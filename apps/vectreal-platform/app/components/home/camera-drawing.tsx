import { cn } from '@shared/utils'

import styles from './camera-drawing.module.css'
import { HERO_OBJECT_URL, HERO_POSTERS } from './hero/hero-assets'

import type { CSSProperties } from 'react'

const { url, ink } = HERO_POSTERS.sheet

/*
  The poster is the whole 4:3 frame, mostly empty paper. Cropped to where the
  lines lie, the camera fills whatever box it is given: the image is scaled up
  by the inverse of the crop's share of the frame, and positioned so the crop's
  corner meets the box's corner.

  The crop is the ink's extent with a margin, so the rendered camera's shadow,
  which reaches below the drawn base, is not cut off where the lines stop.
*/
const PAD = { x: 0.08, y: 0.18 }
const inkW = ink.r - ink.l
const inkH = ink.b - ink.t
const left = Math.max(0, ink.l - PAD.x * inkW)
const top = Math.max(0, ink.t - PAD.y * inkH)
const cropW = Math.min(1, ink.r + PAD.x * inkW) - left
const cropH = Math.min(1, ink.b + PAD.y * inkH) - top

const CROP = {
	'--drawing': `url("${url}")`,
	'--crop-aspect': `${(cropW * 4) / (cropH * 3)}`,
	'--crop-w': `${100 / cropW}%`,
	'--crop-h': `${100 / cropH}%`,
	'--crop-x': `${(left / (1 - cropW)) * 100}%`,
	'--crop-y': `${(top / (1 - cropH)) * 100}%`,
	// The same crop as offsets, for an image placed inside the box rather than painted as its background.
	'--crop-left': `${(-left / cropW) * 100}%`,
	'--crop-top': `${(-top / cropH) * 100}%`
} as CSSProperties

/**
 * The hero camera's front elevation as a line drawing, in the page's ink.
 *
 * The same baked mask the hero opens on, so wherever the camera stands in for
 * something further down the page, it is recognizably the object the reader
 * has already turned. One file serves both themes: the mask is filled with the
 * text color, so it inks in whatever the surface it sits on writes in.
 *
 * Sized by its width, at the crop's own aspect. `pencil` sets it faint, the
 * way the hero shows the drawing before the file has arrived.
 */
export const CameraDrawing = ({
	pencil = false,
	className
}: {
	pencil?: boolean
	className?: string
}) => (
	<div
		aria-hidden="true"
		style={CROP}
		className={cn(styles.drawing, pencil && styles.pencil, className)}
	/>
)

/**
 * The same camera rendered, in the same crop, so it lies exactly over its
 * drawing.
 *
 * An image rather than a background, so it loads lazily: a background image is
 * fetched with the page however far down it sits, and this one weighs more
 * than the drawing.
 */
export const CameraObject = ({ className }: { className?: string }) => (
	<div aria-hidden="true" style={CROP} className={cn(styles.object, className)}>
		<img src={HERO_OBJECT_URL} alt="" loading="lazy" decoding="async" />
	</div>
)
