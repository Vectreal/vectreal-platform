import { Html } from '@react-three/drei'
import { cn } from '@shared/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

import { resolveHotspotInteraction } from './hotspot-interaction'

import type { HotspotMarker as HotspotMarkerModel } from './resolve-hotspot-markers'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Group } from 'three'

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

/** Hoisted so drei's `styles` memo is not defeated by a fresh object per render. */
const HTML_WRAPPER_STYLE = { pointerEvents: 'none' } as const

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
	// `vctrl-hotspot-body` carries no styles of its own. It is the hook the
	// selected and hidden rules in styles.css reach for, and they have to land on
	// a descendant of the root: `hotspotColor` writes `--vctrl-hotspot-fill` as an
	// inline style on the root itself, and an inline declaration beats any
	// stylesheet rule for the same property on the same element.
	body: 'vctrl-hotspot-body relative m-0 flex min-h-6 min-w-6 appearance-none items-center justify-center rounded-full border-0 bg-transparent p-0 leading-none',
	live: 'pointer-events-auto',
	inert: 'pointer-events-none',
	interactive: 'cursor-pointer',
	// `font-[600]` and `leading-[1.4]` rather than the named scale: a named value
	// registers its theme variable in the published stylesheet's `:root, :host`
	// block, which lands in a host application after hydration. See styles.css.
	dot: `flex shrink-0 items-center justify-center rounded-full bg-[var(--vctrl-hotspot-fill)] font-[600] text-[var(--vctrl-hotspot-ink)] ${RING_SHADOW}`,
	dotPlain: 'h-3 w-3',
	dotStep: 'h-5 w-5 text-[10px]',
	// Centring lives in styles.css, where `text-box` can read the rendered
	// font's own cap metric instead of a constant calibrated to a font this
	// package names but does not ship.
	numeral: 'vctrl-hotspot-numeral',
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
	/** Drawn as the one an editing surface has picked out. */
	selected?: boolean
	/** Overrides the marker fill. Any CSS colour; undefined keeps the default. */
	color?: string
	/** Runs when a hotspot carrying a `linkedCameraId` is activated. */
	onActivate?: (cameraId: string) => void
	/** Runs when a marker is picked on a surface that selects rather than flies. */
	onSelect?: (id: string) => void
	/**
	 * Hands `SceneHotspots` the anchor group it moves during a drag, and `null`
	 * on unmount. See the group below.
	 */
	onAnchorRef: (id: string, node: Group | null) => void
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
	selected = false,
	color,
	onActivate,
	onSelect,
	onAnchorRef
}: HotspotMarkerProps) => {
	const [labelVisible, setLabelVisible] = useState(false)
	const touchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

	const interaction = resolveHotspotInteraction(marker, {
		occluded,
		canActivate: !!onActivate,
		canSelect: !!onSelect
	})

	// A block body, not a concise one. React 19 treats a *function* returned from
	// a callback ref as its cleanup and then stops calling `ref(null)`, so a
	// concise body forwarding the registrar's return value is one refactor of that
	// registrar away from silently leaking every anchor. Nothing warns.
	const anchorRef = useCallback(
		(node: Group | null) => {
			onAnchorRef(marker.id, node)
		},
		[marker.id, onAnchorRef]
	)

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
		if (interaction.action === 'select') {
			onSelect?.(marker.id)
		} else if (interaction.action === 'activate' && marker.linkedCameraId) {
			onActivate?.(marker.linkedCameraId)
		}
	}, [
		interaction.action,
		marker.id,
		marker.linkedCameraId,
		onActivate,
		onSelect
	])

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
		/*
		  The anchor `SceneHotspots` writes to while this marker is being dragged.
		  drei's `Html` renders a group of its own and does not forward a ref to it,
		  so following a gizmo at 60fps needs a group of ours to mutate.

		  Unconditional, never gated on whether an editing surface is attached:
		  wrapping conditionally would remount the `Html` the moment editing turned
		  on, tearing down drei's portal and dropping keyboard focus with it. The
		  `position` prop stays here so a marker is correct with zero frames
		  elapsed - a consumer may be running `frameloop="demand"` - and so React
		  keeps handling every update that is not a drag.
		*/
		<group ref={anchorRef} position={marker.position}>
			{/*
			  `pointerEvents: 'none'` on the wrapper, not just on the body.

			  drei's non-transform branch renders `{position, transform, ...style}`
			  and nothing else, so without this its div defaults to `auto` and
			  shrink-wraps the marker - a 24px box that takes the pointer even when
			  the body inside it has refused it. Two things break without it: the
			  `pointerEvents: 'none'` an occluded marker asks for is overruled one
			  level up, so a marker faded to 15% still swallows clicks and blocks an
			  orbit started on top of it; and an authoring surface listening on the
			  canvas never sees a press that lands here at all. Its `pointerEvents`
			  prop is no use - that one only reaches the inner div in transform mode.
			*/}
			<Html
				center
				zIndexRange={HOTSPOT_Z_INDEX_RANGE}
				style={HTML_WRAPPER_STYLE}
			>
				<div
					className={cn(markerClasses.root, occluded && markerClasses.occluded)}
					style={colorStyle}
					data-selected={selected || undefined}
					data-hidden={marker.hidden || undefined}
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
								interaction.action !== 'none' && markerClasses.interactive
							)}
							aria-label={marker.accessibleName}
							aria-pressed={interaction.toggles ? selected : undefined}
							aria-disabled={interaction.action === 'none' ? true : undefined}
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
		</group>
	)
}

export default HotspotMarker
