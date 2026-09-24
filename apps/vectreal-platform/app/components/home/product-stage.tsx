import { cn } from '@shared/utils'
import {
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
	type CSSProperties
} from 'react'

import { CameraDrawing } from './camera-drawing'
import { StageBoundary } from './hero/stage-boundary'
import { HOME_PAGE_COPY } from '../../constants/product-copy'

const LIVE_HINT = HOME_PAGE_COPY.stage.status.live

const EmbedStage = lazy(() => import('./embed-stage-client'))

/** A box as fractions of the window's frame: x and w of its width, y and h of its height. */
export interface FrameRect {
	x: number
	y: number
	w: number
	h: number
}

/** The margin around the camera inside its place, as a share of the place: a product photo's breathing room. */
const MARGIN = 0.08

const GLIDE =
	'duration-(--duration-cinematic) ease-(--ease-in-out) motion-reduce:transition-none'

/** Where the camera is drawn: its place, less the margin on every side. */
export function frameBox({ x, y, w, h }: FrameRect): CSSProperties {
	return {
		left: `${(x + w * MARGIN) * 100}%`,
		top: `${(y + h * MARGIN) * 100}%`,
		width: `${w * (1 - 2 * MARGIN) * 100}%`,
		height: `${h * (1 - 2 * MARGIN) * 100}%`
	}
}

/** Everything outside the place, cut away: the shadow reaches the place's edges and no further. */
export function placeClip({ x, y, w, h }: FrameRect) {
	const pct = (n: number) => `${n * 100}%`
	return `inset(${pct(y)} ${pct(1 - x - w)} ${pct(1 - y - h)} ${pct(x)})`
}

/**
 * The hero's camera, live, carried through the product window's three views.
 *
 * Prepare and Manage are screenshots of the app with one thing taken out: the
 * viewer's canvas in the publisher, and the camera scene's thumbnail on the
 * dashboard. The camera stands where that was, so the app around it is real
 * and the camera in it is live. Embed puts it in a shop's product page.
 * Switching views glides it from place to place: the object stays the same and
 * the world around it changes, which is the workflow's point.
 *
 * The canvas covers the whole window and never changes size, so its buffers
 * are built once. What moves is where the camera is aimed, the frame box, and
 * what is let through, the clip: each view's place is a different shape, and a
 * canvas cut to one shape would crop the shadow, or leave it ending short of
 * the place's edge, in the others.
 *
 * The camera's line drawing holds the place until the window is first on
 * screen; then the live stage mounts over it and stays. It is the hero's own
 * engine and file, so it costs almost nothing the page has not already loaded,
 * and it draws only when something changes.
 */
export const ProductStage = ({
	visible,
	place,
	hint
}: {
	/** The window is on screen: the first time, the live stage mounts. */
	visible: boolean
	/** Where the camera stands now. */
	place: FrameRect
	/** Invite a drag: only where the stage reads as a product viewer. */
	hint: boolean
}) => {
	const [wanted, setWanted] = useState(false)
	const [live, setLive] = useState(false)
	const frameRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (visible) setWanted(true)
	}, [visible])

	return (
		// Hidden from assistive tech: the screenshots' text says what each view is, and the stage takes no focus, so a drag is all it offers.
		<div
			aria-hidden="true"
			className={cn('absolute inset-0 transition-[clip-path]', GLIDE)}
			style={{ clipPath: placeClip(place) }}
		>
			<div
				ref={frameRef}
				className={cn(
					'pointer-events-none absolute flex items-center transition-[left,top,width,height]',
					GLIDE
				)}
				style={frameBox(place)}
			>
				<div
					className={cn(
						'w-full transition-opacity duration-(--duration-base)',
						live && 'opacity-0'
					)}
				>
					<CameraDrawing pencil className="w-full" />
				</div>
			</div>
			{wanted && (
				<StageBoundary>
					<Suspense fallback={null}>
						<EmbedStage
							frameRef={frameRef}
							place={place}
							onLive={() => setLive(true)}
						/>
					</Suspense>
				</StageBoundary>
			)}
			<span
				className={cn(
					'text-muted-foreground text-label-xs pointer-events-none absolute transition-opacity duration-(--duration-base)',
					(!live || !hint) && 'opacity-0'
				)}
				style={{
					left: `calc(${place.x * 100}% + 1rem)`,
					bottom: `calc(${(1 - place.y - place.h) * 100}% + 1rem)`
				}}
			>
				{LIVE_HINT}
			</span>
		</div>
	)
}
