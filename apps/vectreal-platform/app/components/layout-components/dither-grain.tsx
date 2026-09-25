import { cn } from '@shared/utils'
import { useEffect, useRef } from 'react'

import { BAYER_4, DITHER_CELL_PX } from '../../lib/dither/dither'

// The home hero backdrop's value noise, so every grain on the site is one material.
const hash = (x: number, y: number) => {
	const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
	return s - Math.floor(s)
}
function noise(x: number, y: number) {
	const ix = Math.floor(x)
	const iy = Math.floor(y)
	let fx = x - ix
	let fy = y - iy
	fx = fx * fx * (3 - 2 * fx)
	fy = fy * fy * (3 - 2 * fy)
	const top = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * fx
	const bottom =
		hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * fx
	return top + (bottom - top) * fy
}
const smoothstep = (a: number, b: number, x: number) => {
	const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
	return t * t * (3 - 2 * t)
}

/** Where the grain rises from, and how far it reaches, in the box it fills. */
const ORIGINS = {
	left: (w: number, h: number) => ({
		ox: 0,
		oy: h * 0.55,
		rx: Math.min(w * 0.55, 760),
		ry: h * 0.7
	}),
	right: (w: number, h: number) => ({
		ox: w,
		oy: h * 0.5,
		rx: Math.min(w * 0.5, 720),
		ry: h * 0.7
	}),
	bottom: (w: number, h: number) => ({
		ox: w * 0.3,
		oy: h * 0.72,
		rx: Math.min(w * 0.5, 720),
		ry: h * 0.6
	})
} as const

/** How far in from the box's top and bottom edges the grain is gone, so it never ends on a straight cut. */
const EDGE_FADE_PX = 96

interface DitherGrainProps {
	origin: keyof typeof ORIGINS
	/** Positions the box. Defaults to filling its nearest positioned ancestor, behind it. */
	className?: string
}

/**
 * The home hero's grain, as a still: a patch of the page's ordered dither
 * rising from one edge of a section, in the same matrix, cell and noise as the
 * hero's moving backdrop.
 *
 * Painted on a 2D canvas when it mounts and again only when its size or the
 * theme changes. It does not move: the hero's drift was accepted for the hero,
 * and a section has no state to report. The parent must be a stacking context
 * (`isolate`), so the grain sits behind its content and above its surface.
 */
export function DitherGrain({ origin, className }: DitherGrainProps) {
	const ref = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = ref.current
		const context = canvas?.getContext('2d')
		if (!canvas || !context) return

		function paint() {
			if (!canvas || !context) return
			const dpr = Math.min(window.devicePixelRatio, 2)
			const { width, height } = canvas.getBoundingClientRect()
			if (!width || !height) return
			canvas.width = Math.round(width * dpr)
			canvas.height = Math.round(height * dpr)
			const style = getComputedStyle(canvas)
			const dark = document.documentElement.classList.contains('dark')
			context.fillStyle = `color-mix(in oklch, ${style.getPropertyValue('--foreground')} ${dark ? 9 : 7}%, ${style.getPropertyValue('--background')})`

			const columns = Math.ceil(width / DITHER_CELL_PX)
			const rows = Math.ceil(height / DITHER_CELL_PX)
			const cell = DITHER_CELL_PX * dpr
			const { ox, oy, rx, ry } = ORIGINS[origin](width, height)
			for (let y = 0; y < rows; y++) {
				for (let x = 0; x < columns; x++) {
					const cx = (x + 0.5) * DITHER_CELL_PX
					const cy = (y + 0.5) * DITHER_CELL_PX
					// The hero's scales: patches of about 200px in two octaves, the edge breathing at about 360px.
					const edge = noise(cx / 360 + 3.1, cy / 360) - 0.5
					const blob =
						1 -
						smoothstep(
							0,
							1,
							Math.hypot((cx - ox) / rx, (cy - oy) / ry) + edge * 0.5
						)
					const n =
						0.5 * noise(cx / 200, cy / 200) +
						0.5 * noise((cx / 200) * 1.9 + 5.2, (cy / 200) * 1.9 - 1.7)
					const patchy = 0.35 + 0.65 * smoothstep(0.3, 0.8, n)
					const edges =
						smoothstep(0, EDGE_FADE_PX, cy) *
						(1 - smoothstep(height - EDGE_FADE_PX, height, cy))
					if (
						(BAYER_4[(y % 4) * 4 + (x % 4)] + 0.5) / 16 <
						blob * patchy * 0.8 * edges
					) {
						context.fillRect(x * cell, y * cell, cell, cell)
					}
				}
			}
			canvas.dataset.painted = ''
		}

		const resize = new ResizeObserver(paint)
		resize.observe(canvas)
		const theme = new MutationObserver(paint)
		theme.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		})
		return () => {
			resize.disconnect()
			theme.disconnect()
		}
	}, [origin])

	/*
	  A canvas keeps its intrinsic height under top and bottom, so a box sizes it
	  and it fills the box.

	  Hidden until the first paint, then faded in. It can only paint once the
	  page is running, a beat after the content it sits behind has been drawn
	  from the server's HTML, and it used to land all at once in that beat.
	*/
	return (
		<div
			aria-hidden="true"
			className={cn('pointer-events-none absolute inset-0 -z-1', className)}
		>
			<canvas
				ref={ref}
				className="block size-full opacity-0 transition-opacity duration-(--duration-cinematic) ease-(--ease-out) data-painted:opacity-100 motion-reduce:transition-none"
			/>
		</div>
	)
}
