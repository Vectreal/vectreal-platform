import { Html } from '@react-three/drei'
import { cn } from '@shared/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

import { resolveHotspotInteraction } from './hotspot-interaction'

import type { HotspotMarker as HotspotMarkerModel } from './resolve-hotspot-markers'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'

/**
 * Under the viewer's own overlay chrome, which sits at 100 (the animation
 * controls and the info popover), so a hotspot never paints over a control.
 * drei writes a depth-derived value inside this range onto each marker every
 * frame, which is also what decides how two overlapping markers stack.
 */
const HOTSPOT_Z_INDEX_RANGE = [40, 0]

/**
 * How long the name stays up after a tap.
 *
 * A touch produces `pointerenter` and `pointerleave` back to back, so the
 * hover treatment alone leaves the name unreachable on a phone - and a marker
 * without a linked camera is not focusable either, so there is no other way to
 * read it.
 */
const TOUCH_LABEL_DURATION_MS = 2500

/**
 * A hairline edge and a soft shadow, on every preset.
 *
 * One pixel of dark edge is all a white disc needs to separate from a pale
 * product, and it is the whole reason the fill can be neutral. A heavier ring
 * turns the marker into a badge stuck onto the render; this reads as part of
 * the viewer. The shadow does the lifting on dark scenes, where the edge itself
 * disappears and the fill carries.
 *
 * The edge carries the marker alone on a white product, where a white fill has
 * no contrast of its own, so its alpha is the one number here that is a
 * legibility floor rather than a taste call - measured at 1.6:1 over white at
 * 0.18, which was too weak to see.
 */
const RING_SHADOW =
	'shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.3)]'

/**
 * A white ring inside a dark halo, and independent of the fill so a focused
 * marker is distinguishable from the marker itself whatever colour it is.
 */
const FOCUS_RING =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white focus-visible:shadow-[0_0_0_4px_rgba(0,0,0,0.5)]'

const markerClasses = {
	root: 'vctrl-viewer-hotspot pointer-events-none relative flex items-center justify-center opacity-100 transition-opacity duration-300 ease-out',
	// Focus overrides the fade: a keyboard user who reaches an occluded marker
	// has to be able to see which one they are on.
	occluded: 'opacity-15 focus-within:opacity-100',
	// Sits outside the artwork's own ring rather than flush with the box, so the
	// resting ring is still visible when the animation is switched off.
	pulse:
		'vctrl-hotspot-pulse pointer-events-none absolute -inset-1 rounded-full',
	// A 24px floor on the box that takes the pointer, which then grows to fit
	// whatever is inside it. The plain dot is 12px: well under the minimum target
	// size, and missed by a thumb on a touch screen.
	body: 'relative m-0 flex min-h-6 min-w-6 appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 leading-none',
	live: 'pointer-events-auto',
	inert: 'pointer-events-none',
	interactive: 'cursor-pointer',
	// `font-[600]` and `leading-[1.4]` rather than the named scale: a named value
	// registers its theme variable in the published stylesheet's `:root, :host`
	// block, which lands in a host application after hydration. See styles.css.
	dot: `flex shrink-0 items-center justify-center rounded-full bg-[var(--vctrl-hotspot-fill)] font-[600] text-[var(--vctrl-hotspot-ink)] ${RING_SHADOW}`,
	dotPlain: 'h-3 w-3',
	dotStep: 'h-5 w-5 text-[10px]',
	/*
	  Optical centring for the numeral, and the reason it is not simply
	  `items-center`.

	  Flex centres the text's box, not its ink. DM Sans reports ascent 10 and
	  descent 3, and a digit has no ink below the baseline, so the drawn glyph
	  ends up half its descent above the middle of the disc - measured at 0.50px
	  on the 20px step disc and 0.50px on the 16px badge, which is visible on a
	  shape that small.

	  In `em` rather than pixels so it holds if either size changes, and applied
	  to a wrapper so the disc itself does not move. Font-specific by nature: it
	  is the metric asymmetry of DM Sans, which `styles.css` sets for the viewer.
	*/
	numeral: 'block translate-y-[0.05em]',
	// A raster payload is someone's photograph or icon: it needs its own ground
	// to read against arbitrary scene colour behind it. `max-w-none` because a
	// host application's CSS reset caps images at their container width, which
	// would squeeze the artwork back down to the 24px target floor.
	image: `h-7 w-7 max-w-none shrink-0 rounded-full bg-white object-cover ${RING_SHADOW}`,
	// A vector payload is drawn to sit on the scene directly. A frame would fight
	// the artwork, so it gets a drop shadow for separation instead.
	svg: 'h-7 w-7 max-w-none shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]',
	// Offset clear of the artwork rather than overlapping its corner.
	badge: `absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--vctrl-hotspot-fill)] text-[10px] font-[600] text-[var(--vctrl-hotspot-ink)] ${RING_SHADOW}`,
	// `rounded-full`, never `rounded`: this package clears Tailwind's radius
	// namespace (see styles.css), so every named radius but `full` compiles to
	// nothing once the package is consumed from npm.
	label:
		'pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 max-w-[180px] -translate-x-1/2 truncate rounded-full bg-[var(--vctrl-bg)] px-2 py-0.5 text-[11px] leading-[1.4] text-[var(--vctrl-text)] shadow-[0_1px_6px_rgba(0,0,0,0.3)] select-none'
} as const

export interface HotspotMarkerProps {
	marker: HotspotMarkerModel
	/** Computed by `SceneHotspots`, which owns the depth test for every marker. */
	occluded: boolean
	/** Overrides the marker fill. Any CSS colour; undefined keeps the default. */
	color?: string
	/** Runs when a hotspot carrying a `linkedCameraId` is activated. */
	onActivate?: (cameraId: string) => void
}

/**
 * A single hotspot, drawn as DOM over the canvas.
 *
 * DOM rather than in-scene geometry because a marker has to stay the same size
 * at any distance, take a real focus ring, and carry text a screen reader can
 * read. drei's `Html` handles the projection, and hides the marker on its own
 * once it passes behind the camera.
 */
const HotspotMarker = ({
	marker,
	occluded,
	color,
	onActivate
}: HotspotMarkerProps) => {
	const [labelVisible, setLabelVisible] = useState(false)
	const touchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

	const interaction = resolveHotspotInteraction(marker, {
		occluded,
		canActivate: !!onActivate
	})

	const clearTouchTimeout = () => {
		if (touchTimeout.current !== null) {
			clearTimeout(touchTimeout.current)
			touchTimeout.current = null
		}
	}

	useEffect(() => clearTouchTimeout, [])

	const showLabel = useCallback(() => {
		clearTouchTimeout()
		setLabelVisible(true)
	}, [])

	const hideLabel = useCallback(() => {
		clearTouchTimeout()
		setLabelVisible(false)
	}, [])

	const handlePointerEnter = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			clearTouchTimeout()
			setLabelVisible(true)
			// A touch fires enter and leave in the same gesture, so hold the name up
			// for long enough to read instead of letting leave take it straight back.
			if (event.pointerType !== 'mouse') {
				touchTimeout.current = setTimeout(
					() => setLabelVisible(false),
					TOUCH_LABEL_DURATION_MS
				)
			}
		},
		[]
	)

	const handlePointerLeave = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.pointerType !== 'mouse') return
			clearTouchTimeout()
			setLabelVisible(false)
		},
		[]
	)

	const handleClick = useCallback(() => {
		if (interaction.activatable && marker.linkedCameraId) {
			onActivate?.(marker.linkedCameraId)
		}
	}, [interaction.activatable, marker.linkedCameraId, onActivate])

	// Set on the marker root rather than the viewer container: drei portals every
	// Html separately, so there is no shared ancestor inside the marker layer.
	// Omitted entirely when no colour was passed, so the default path emits no
	// inline style at all.
	const colorStyle = color
		? ({ '--vctrl-hotspot-fill': color } as CSSProperties)
		: undefined

	const bodyClasses = cn(
		markerClasses.body,
		interaction.pointerEvents === 'auto'
			? markerClasses.live
			: markerClasses.inert
	)

	const body =
		marker.preset === 'dot' ? (
			<span
				className={cn(
					markerClasses.dot,
					marker.step === null ? markerClasses.dotPlain : markerClasses.dotStep
				)}
			>
				<span className={markerClasses.numeral}>{marker.step}</span>
			</span>
		) : (
			<>
				<img
					src={marker.payloadUrl ?? undefined}
					alt=""
					className={
						marker.preset === 'image' ? markerClasses.image : markerClasses.svg
					}
				/>
				{marker.step !== null && (
					<span className={markerClasses.badge}>
						<span className={markerClasses.numeral}>{marker.step}</span>
					</span>
				)}
			</>
		)

	return (
		<Html center position={marker.position} zIndexRange={HOTSPOT_Z_INDEX_RANGE}>
			<div
				className={cn(markerClasses.root, occluded && markerClasses.occluded)}
				style={colorStyle}
				onPointerEnter={handlePointerEnter}
				onPointerLeave={handlePointerLeave}
			>
				<span aria-hidden="true" className={markerClasses.pulse} />

				{interaction.role === 'button' ? (
					<button
						type="button"
						className={cn(
							bodyClasses,
							FOCUS_RING,
							interaction.activatable && markerClasses.interactive
						)}
						aria-label={marker.accessibleName}
						aria-disabled={interaction.activatable ? undefined : true}
						tabIndex={interaction.focusable ? undefined : -1}
						onClick={handleClick}
						onFocus={showLabel}
						onBlur={hideLabel}
					>
						{body}
					</button>
				) : (
					<div
						className={bodyClasses}
						role="img"
						aria-label={marker.accessibleName}
					>
						{body}
					</div>
				)}

				{labelVisible && (
					<span className={markerClasses.label}>{marker.name}</span>
				)}
			</div>
		</Html>
	)
}

export default HotspotMarker
