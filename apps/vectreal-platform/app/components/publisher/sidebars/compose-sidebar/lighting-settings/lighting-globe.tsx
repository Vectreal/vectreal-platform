import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import {
	ENVIRONMENT_LIGHTS,
	litLights,
	type EnvironmentKey,
	type ResolvedSceneLight
} from '@vctrl/core'
import { useId, useRef, useState } from 'react'

import {
	dragDegrees,
	DEFAULT_GLOBE_VIEW,
	globeTilt,
	projectOnGlobe,
	type GlobeView,
	type GlobePoint
} from './globe-projection'
import {
	BRIGHT_SPOT_GLOSSARY,
	BRIGHT_SPOT_LABEL,
	LIGHT_GLOSSARY,
	LIGHT_LABELS
} from './light-views'
import { wrapDegrees } from './lighting-edits'

/** The drawing's width and height, and the globe's radius in it. */
const SIZE = 148
const RADIUS = 62
const CENTER = SIZE / 2
/** Meridians drawn on the sky, environment-fixed, every this many degrees. */
const MERIDIAN_STEP = 45
const MERIDIAN_SAMPLES = 12
/** A turn wraps to [-180, 180): 180 is -180, so the last whole degree is 179. */
const MAX_TURN = 179
/** How far from a mark's center a pointer still names it: 18 px across, drawn at full size. */
const HIT_RADIUS = 9

const at = ({ x, y }: GlobePoint) =>
	`${(CENTER + x * RADIUS).toFixed(2)},${(CENTER + y * RADIUS).toFixed(2)}`

/** The whole degree a turn shows as: rounding 179.6 up wraps it to -180. */
const shownDegrees = (rotation: number) => wrapDegrees(Math.round(rotation))

export const formatDegrees = (rotation: number) => `${shownDegrees(rotation)}°`

/** One thing drawn on the globe that the glossary names. */
interface GlobeMark {
	id: string
	kind: 'light' | 'behind' | 'glow'
	label: string
	description: string
	point: GlobePoint
	color?: string
}

/** A glossary row's swatch, drawn like the mark it names. */
function MarkSwatch({ kind, color }: Pick<GlobeMark, 'kind' | 'color'>) {
	return (
		<span
			aria-hidden
			style={kind === 'light' ? { backgroundColor: color } : undefined}
			className={cn(
				'size-1.5 shrink-0 rounded-full',
				kind === 'light' && 'ring-foreground ring-1',
				kind === 'behind' && 'border-foreground/50 border border-dashed',
				kind === 'glow' && 'bg-foreground/30'
			)}
		/>
	)
}

export interface LightingGlobeProps {
	/** The environment's turn in degrees, wrapped to [-180, 180). */
	rotation: number
	onRotationChange: (rotation: number) => void
	map: EnvironmentKey
	lights: ResolvedSceneLight[]
	/** Where the orbit camera looks from, so the globe matches the scene on screen. */
	view?: GlobeView
	className?: string
}

/**
 * Turns the whole setup around the model: the environment and every light
 * with it, about the vertical axis only, so the environment's horizon stays on
 * the ground. Drawn as the sky seen from the orbit camera: its horizon, the
 * environment's bright regions, and each light in its color. Dragging sideways
 * turns it; to assistive technology it is a slider in degrees. Its label and
 * value belong to the setting group it sits in.
 *
 * Each mark is named by a glossary that adds nothing at rest: a pointer over
 * a mark shows it in a tooltip, and keyboard focus or a touch drag shows the
 * whole list under the globe, since neither has a hover. The slider is
 * described by that list either way.
 */
export function LightingGlobe({
	rotation,
	onRotationChange,
	map,
	lights,
	view = DEFAULT_GLOBE_VIEW,
	className
}: LightingGlobeProps) {
	const id = useId()
	const shadeId = `${id}-shade`
	const glowId = `${id}-glow`
	const glossaryId = `${id}-glossary`
	const drag = useRef<{ x: number; rotation: number } | null>(null)
	/*
	  The mark under the pointer as it was when the pointer reached it. The
	  tooltip shows that copy rather than the live mark, so it fades out with
	  its own words and place, and it closes for good once the live mark moves
	  or goes: a turn, a new map, the camera or a light can each carry it out
	  from under the pointer, and a bright spot that turns behind unmounts
	  without a pointerleave.
	*/
	const [tip, setTip] = useState<{ mark: GlobeMark; open: boolean } | null>(
		null
	)
	const closeTip = () =>
		setTip((current) => current && { ...current, open: false })
	/*
	  The mark a press ended over. Releasing the pointer capture enters it
	  again before the pointer has moved, which would reopen the tooltip the
	  press closed, so it stays quiet until the pointer next moves.
	*/
	const quietMarkId = useRef<string | null>(null)
	const [glossaryShown, setGlossaryShown] = useState(false)
	const turnTo = (next: number) => onRotationChange(wrapDegrees(next))

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		// A key on a globe a click focused turns its focus visible too, with no
		// new focus event to say so.
		setGlossaryShown(true)
		const stepsByKey: Record<string, number> = {
			ArrowRight: 1,
			ArrowUp: 1,
			ArrowLeft: -1,
			ArrowDown: -1,
			PageUp: 10,
			PageDown: -10
		}
		const steps = stepsByKey[event.key]
		if (steps !== undefined) {
			event.preventDefault()
			turnTo(rotation + steps * (event.shiftKey ? 10 : 1))
		} else if (event.key === 'Home' || event.key === 'End') {
			// A slider's ends, as assistive technology expects; a double-click
			// turns it back to the front.
			event.preventDefault()
			onRotationChange(event.key === 'Home' ? -180 : MAX_TURN)
		}
	}

	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		// The primary button only: a context menu swallows the release.
		if (event.button !== 0) return
		if (event.pointerType === 'touch') {
			setGlossaryShown(true)
			// So that leaving the globe, which blurs it, hides the glossary again.
			event.currentTarget.focus({ preventScroll: true })
		}
		event.currentTarget.setPointerCapture(event.pointerId)
		drag.current = { x: event.clientX, rotation }
	}
	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!drag.current) {
			quietMarkId.current = null
			return
		}
		const scale = event.currentTarget.clientWidth / SIZE || 1
		turnTo(
			Math.round(
				drag.current.rotation +
					dragDegrees(event.clientX - drag.current.x, RADIUS * scale)
			)
		)
	}
	const endDrag = () => (drag.current = null)
	const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		endDrag()
		quietMarkId.current =
			document
				.elementFromPoint(event.clientX, event.clientY)
				?.closest('[data-mark]')
				?.getAttribute('data-mark') ?? null
	}

	// Only keyboard focus shows the glossary: a click focuses the globe too,
	// and a pointer has the tooltips.
	const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
		if (event.currentTarget.matches(':focus-visible')) setGlossaryShown(true)
	}

	const hoverMark = (event: React.PointerEvent, mark: GlobeMark) => {
		if (
			event.pointerType !== 'touch' &&
			!drag.current &&
			mark.id !== quietMarkId.current
		)
			setTip({ mark, open: true })
	}
	const leaveMark = (mark: GlobeMark) =>
		setTip((current) =>
			current?.mark.id === mark.id ? { ...current, open: false } : current
		)

	const tilt = globeTilt(view)
	const horizonRy = RADIUS * Math.abs(Math.sin((tilt * Math.PI) / 180))
	// Arc sweeps, left to right: the near half of the horizon is the lower one
	// seen from above, the upper one seen from below.
	const nearSweep = tilt < 0 ? 1 : 0
	const farSweep = 1 - nearSweep
	const meridians = Array.from(
		{ length: 360 / MERIDIAN_STEP },
		(_, i) => i * MERIDIAN_STEP
	).map((azimuth) =>
		Array.from({ length: MERIDIAN_SAMPLES + 1 }, (_, k) =>
			projectOnGlobe(
				{ azimuth, elevation: (90 * k) / MERIDIAN_SAMPLES },
				rotation,
				view
			)
		)
	)
	const regions = ENVIRONMENT_LIGHTS[map].map((region) => ({
		region,
		point: projectOnGlobe(region, rotation, view)
	}))
	// The lights the scene draws.
	const shown = litLights({ lights }).map((light) => ({
		light,
		point: projectOnGlobe(light, rotation, view)
	}))

	const glows: GlobeMark[] = regions.flatMap(({ point }, i) =>
		point.front
			? [
					{
						id: `glow-${i}`,
						kind: 'glow' as const,
						label: BRIGHT_SPOT_LABEL,
						description: BRIGHT_SPOT_GLOSSARY,
						point
					}
				]
			: []
	)
	const lightMarks: GlobeMark[] = shown.map(({ light, point }) => ({
		id: light.role,
		kind: point.front ? 'light' : 'behind',
		label: point.front
			? LIGHT_LABELS[light.role]
			: `${LIGHT_LABELS[light.role]}, behind`,
		description: LIGHT_GLOSSARY[light.role],
		point,
		color: light.color
	}))
	// Hit areas in drawing order, so a light wins over the glow it sits on.
	const marks = [...glows, ...lightMarks]
	// One row for every bright spot: they all mean the same thing.
	const glossary = [...lightMarks, ...glows.slice(0, 1)]
	if (tip?.open) {
		const live = marks.find((mark) => mark.id === tip.mark.id)
		const moved =
			!live ||
			live.label !== tip.mark.label ||
			live.point.x !== tip.mark.point.x ||
			live.point.y !== tip.mark.point.y
		if (moved) setTip({ ...tip, open: false })
	}
	const tipMark = tip?.mark

	return (
		<div>
			<div
				role="slider"
				tabIndex={0}
				aria-label="Turn"
				aria-valuemin={-180}
				aria-valuemax={MAX_TURN}
				aria-valuenow={shownDegrees(rotation)}
				aria-valuetext={formatDegrees(rotation)}
				aria-orientation="horizontal"
				aria-describedby={glossaryId}
				onKeyDown={handleKeyDown}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={endDrag}
				onLostPointerCapture={endDrag}
				onDoubleClick={() => turnTo(0)}
				onFocus={handleFocus}
				onBlur={() => setGlossaryShown(false)}
				className={cn(
					'focus-visible:outline-ring relative mx-auto aspect-square w-full max-w-[9.25rem] cursor-grab touch-none rounded-full select-none focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing',
					className
				)}
			>
				{/* eslint-disable-next-line no-restricted-syntax -- a live drawing of the lighting from its settings, not an icon */}
				<svg
					viewBox={`0 0 ${SIZE} ${SIZE}`}
					className="text-foreground block size-full overflow-visible"
					aria-hidden
				>
					<defs>
						<radialGradient id={shadeId} cx="38%" cy="30%" r="80%">
							<stop offset="0%" style={{ stopColor: 'var(--background)' }} />
							<stop offset="100%" style={{ stopColor: 'var(--muted)' }} />
						</radialGradient>
						{/* A bright region of the environment: light fading out. */}
						<radialGradient id={glowId}>
							<stop offset="0%" stopColor="currentColor" stopOpacity={0.32} />
							<stop offset="100%" stopColor="currentColor" stopOpacity={0} />
						</radialGradient>
					</defs>

					<circle
						cx={CENTER}
						cy={CENTER}
						r={RADIUS}
						fill={`url(#${shadeId})`}
					/>
					{/* The ground: the globe below its horizon. */}
					<path
						d={`M ${CENTER - RADIUS} ${CENTER} A ${RADIUS} ${RADIUS} 0 0 0 ${CENTER + RADIUS} ${CENTER} A ${RADIUS} ${horizonRy} 0 0 ${farSweep} ${CENTER - RADIUS} ${CENTER} Z`}
						fill="currentColor"
						fillOpacity={0.08}
					/>
					<path
						d={`M ${CENTER - RADIUS} ${CENTER} A ${RADIUS} ${horizonRy} 0 0 ${farSweep} ${CENTER + RADIUS} ${CENTER}`}
						fill="none"
						stroke="currentColor"
						strokeOpacity={0.12}
						strokeDasharray="2 3"
					/>
					<path
						d={`M ${CENTER - RADIUS} ${CENTER} A ${RADIUS} ${horizonRy} 0 0 ${nearSweep} ${CENTER + RADIUS} ${CENTER}`}
						fill="none"
						stroke="currentColor"
						strokeOpacity={0.45}
					/>

					{meridians.map((points, i) => (
						<polyline
							key={i}
							points={points
								.filter((point) => point.front)
								.map(at)
								.join(' ')}
							fill="none"
							stroke="currentColor"
							// The environment's own front, so a turn reads at a glance.
							strokeOpacity={i === 0 ? 0.35 : 0.14}
						/>
					))}

					{regions.map(({ region, point }, i) =>
						point.front ? (
							<circle
								key={i}
								cx={CENTER + point.x * RADIUS}
								cy={CENTER + point.y * RADIUS}
								r={6 + 14 * Math.sqrt(region.share)}
								fill={`url(#${glowId})`}
							/>
						) : null
					)}

					{/* A light behind the globe is a dashed ring, seen through it. */}
					{shown.map(({ light, point }) =>
						point.front ? (
							<circle
								key={light.role}
								cx={CENTER + point.x * RADIUS}
								cy={CENTER + point.y * RADIUS}
								r={4.5}
								fill={light.color}
								stroke="currentColor"
								strokeWidth={1.5}
							/>
						) : (
							<circle
								key={light.role}
								cx={CENTER + point.x * RADIUS}
								cy={CENTER + point.y * RADIUS}
								r={4}
								fill="none"
								stroke="currentColor"
								strokeOpacity={0.5}
								strokeDasharray="1.5 1.5"
							/>
						)
					)}

					{marks.map((mark) => (
						<circle
							key={mark.id}
							data-mark={mark.id}
							cx={CENTER + mark.point.x * RADIUS}
							cy={CENTER + mark.point.y * RADIUS}
							r={HIT_RADIUS}
							fill="transparent"
							onPointerEnter={(event) => hoverMark(event, mark)}
							onPointerLeave={() => leaveMark(mark)}
						/>
					))}
				</svg>

				<Tooltip
					// One per anchor: Radix places it when it opens and never again for
					// an anchor that moves without changing size, which this one never
					// does, so a tooltip reopened on another mark would stay on the last.
					key={tipMark && `${tipMark.id}:${tipMark.point.x}:${tipMark.point.y}`}
					open={Boolean(tip?.open)}
					onOpenChange={(open) => {
						// Escape, or a press anywhere, as a drag starts with.
						if (!open) closeTip()
					}}
				>
					<TooltipTrigger asChild>
						<span
							aria-hidden
							className="pointer-events-none absolute size-0"
							style={
								tipMark && {
									left: `${((CENTER + tipMark.point.x * RADIUS) / SIZE) * 100}%`,
									top: `${((CENTER + tipMark.point.y * RADIUS) / SIZE) * 100}%`
								}
							}
						/>
					</TooltipTrigger>
					<TooltipContent side="top" sideOffset={8} className="max-w-56">
						<span className="block font-medium">{tipMark?.label}</span>
						<span className="block opacity-80">{tipMark?.description}</span>
					</TooltipContent>
				</Tooltip>
			</div>

			<ul
				id={glossaryId}
				className={cn(
					glossaryShown
						? 'animate-in fade-in-0 mx-auto mt-3 w-fit space-y-1 duration-(--duration-fast) ease-(--ease-out) motion-reduce:animate-none'
						: 'sr-only'
				)}
			>
				{glossary.map((mark) => (
					<li
						key={mark.id}
						className="text-muted-foreground flex items-center gap-1.5 text-[11px] leading-tight"
					>
						<MarkSwatch kind={mark.kind} color={mark.color} />
						<span>
							<span className="text-foreground/80 font-medium">
								{mark.label}
							</span>
							<span className="sr-only">:</span> {mark.description}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}
