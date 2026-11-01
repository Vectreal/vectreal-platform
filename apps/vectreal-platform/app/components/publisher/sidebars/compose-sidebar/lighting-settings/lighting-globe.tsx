import { cn } from '@shared/utils'
import {
	ENVIRONMENT_LIGHTS,
	litLights,
	type EnvironmentKey,
	type ResolvedSceneLight
} from '@vctrl/core'
import { useId, useRef } from 'react'

import {
	dragDegrees,
	DEFAULT_GLOBE_VIEW,
	globeTilt,
	projectOnGlobe,
	type GlobeView,
	type GlobePoint
} from './globe-projection'
import { LIGHT_LABELS } from './light-views'
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

const at = ({ x, y }: GlobePoint) =>
	`${(CENTER + x * RADIUS).toFixed(2)},${(CENTER + y * RADIUS).toFixed(2)}`

/** The whole degree a turn shows as: rounding 179.6 up wraps it to -180. */
const shownDegrees = (rotation: number) => wrapDegrees(Math.round(rotation))

export const formatDegrees = (rotation: number) => `${shownDegrees(rotation)}°`

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
	const drag = useRef<{ x: number; rotation: number } | null>(null)
	const turnTo = (next: number) => onRotationChange(wrapDegrees(next))

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
		event.currentTarget.setPointerCapture(event.pointerId)
		drag.current = { x: event.clientX, rotation }
	}
	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!drag.current) return
		const scale = event.currentTarget.clientWidth / SIZE || 1
		turnTo(
			Math.round(
				drag.current.rotation +
					dragDegrees(event.clientX - drag.current.x, RADIUS * scale)
			)
		)
	}
	const endDrag = () => (drag.current = null)

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

	return (
		<div
			role="slider"
			tabIndex={0}
			aria-label="Turn"
			aria-valuemin={-180}
			aria-valuemax={MAX_TURN}
			aria-valuenow={shownDegrees(rotation)}
			aria-valuetext={formatDegrees(rotation)}
			aria-orientation="horizontal"
			onKeyDown={handleKeyDown}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={endDrag}
			onPointerCancel={endDrag}
			onLostPointerCapture={endDrag}
			onDoubleClick={() => turnTo(0)}
			className={cn(
				'focus-visible:outline-ring mx-auto aspect-square w-full max-w-[9.25rem] cursor-grab touch-none rounded-full select-none focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing',
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

				<circle cx={CENTER} cy={CENTER} r={RADIUS} fill={`url(#${shadeId})`} />
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
						>
							<title>{LIGHT_LABELS[light.role]}</title>
						</circle>
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
						>
							<title>{`${LIGHT_LABELS[light.role]}, behind`}</title>
						</circle>
					)
				)}
			</svg>
		</div>
	)
}
