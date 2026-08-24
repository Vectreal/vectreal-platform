import { Html } from '@react-three/drei'
import { cn } from '@shared/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

import { resolveHotspotInteraction } from './hotspot-interaction'

import type { HotspotMarker as HotspotMarkerModel } from './resolve-hotspot-markers'
import type { PointerEvent as ReactPointerEvent } from 'react'

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
 * A white inner ring and a dark outer one, on every preset.
 *
 * The brand accent alone does not carry a hotspot: `#fc6c18` is 2.6:1 against
 * the viewer's light ground and 2.9:1 against white, both under the 3:1 that a
 * non-text indicator needs, and a white-only ring disappears against exactly
 * the pale product shots where the accent is already weakest. The pair holds on
 * either ground, which is why it is not simply a border.
 */
const RING_SHADOW =
	'shadow-[0_0_0_1.5px_rgba(255,255,255,0.9),0_0_0_2.5px_rgba(0,0,0,0.4),0_1px_4px_rgba(0,0,0,0.35)]'

/**
 * A white ring inside a dark halo, for the same reason, and independent of the
 * accent so the focused marker is distinguishable from the marker itself.
 */
const FOCUS_RING =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white focus-visible:shadow-[0_0_0_5px_rgba(0,0,0,0.55)]'

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
	// whatever is inside it. The plain dot is 14px: under the minimum target
	// size, and missed by a thumb on a touch screen.
	body: 'relative m-0 flex min-h-6 min-w-6 appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 leading-none',
	live: 'pointer-events-auto',
	inert: 'pointer-events-none',
	interactive: 'cursor-pointer',
	// `font-[600]` and `leading-[1.4]` rather than the named scale: a named value
	// registers its theme variable in the published stylesheet's `:root, :host`
	// block, which lands in a host application after hydration. See styles.css.
	dot: `flex shrink-0 items-center justify-center rounded-full bg-[var(--vctrl-hotspot-accent)] font-[600] text-[var(--vctrl-hotspot-on-accent)] ${RING_SHADOW}`,
	dotPlain: 'h-3.5 w-3.5',
	dotStep: 'h-5 w-5 text-[10px]',
	// A raster payload is someone's photograph or icon: it needs its own ground
	// to read against arbitrary scene colour behind it. `max-w-none` because a
	// host application's CSS reset caps images at their container width, which
	// would squeeze the artwork back down to the 24px target floor.
	image: `h-8 w-8 max-w-none shrink-0 rounded-full bg-white object-cover ${RING_SHADOW}`,
	// A vector payload is drawn to sit on the scene directly. A frame would fight
	// the artwork, so it gets a drop shadow for separation instead.
	svg: 'h-7 w-7 max-w-none shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]',
	// Offset clear of the artwork rather than overlapping its corner.
	badge: `absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--vctrl-hotspot-accent)] text-[10px] font-[600] text-[var(--vctrl-hotspot-on-accent)] ${RING_SHADOW}`,
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
				{marker.step}
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
					<span className={markerClasses.badge}>{marker.step}</span>
				)}
			</>
		)

	return (
		<Html center position={marker.position} zIndexRange={HOTSPOT_Z_INDEX_RANGE}>
			<div
				className={cn(markerClasses.root, occluded && markerClasses.occluded)}
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
