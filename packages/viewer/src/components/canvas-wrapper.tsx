import { PerformanceMonitor } from '@react-three/drei'
import { CanvasProps, Canvas as ThreeCanvas } from '@react-three/fiber'
import { cn } from '@shared/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useViewportDetection } from '../hooks/use-viewport-detection'
import { VIEWER_MODEL_FADE_DURATION_MS } from '../hooks/viewer-loading.constants'

import type { LoadingState } from '../hooks/use-viewer-loading'

interface CanvasComponentProps extends CanvasProps {
	children: React.ReactNode
	/**
	 * ClassName for the outermost container div
	 */
	containerClassName?: string
	/**
	 * Theme to apply to the viewer
	 */
	theme?: 'light' | 'dark' | 'system'

	/**
	 * JSX element to render while loading
	 */
	/**
	 * Additional UI overlays to render (e.g., InfoPopover)
	 */
	overlay?: React.ReactNode
	/**
	 * Whether to render the canvas only when visible in viewport.
	 * When enabled, the canvas unmounts when out of viewport to save resources.
	 * Default: true
	 */
	enableViewportRendering?: boolean
	/**
	 * Viewer loading lifecycle state used to synchronize loader/model cross-fade.
	 */
	loadingState?: LoadingState
	/**
	 * Receives the outermost container, for the viewer's own key handling and
	 * focus management. Must be referentially stable.
	 */
	onContainerChange?: (node: HTMLDivElement | null) => void
}

/**
 * Pixel-ratio range the canvas renders at. Above 2 the extra pixels stop being
 * visible at viewing distance while their cost keeps growing (3x phones would
 * pay 2.25x the fill of 2x). Below the screen's own ratio the canvas is
 * upscaled, which softens and stair-steps every edge.
 */
const MIN_DPR = 1
const MAX_DPR = 2
/** How far the ratio drops each time the device falls behind. */
const DPR_STEP = 0.25

/**
 * An enhanced wrapper around react-three/fiber Canvas that:
 * - Wraps the entire viewer (container + canvas + loader + overlays)
 * - Handles StrictMode double-mounting gracefully
 * - Prevents rendering when outside viewport (optional)
 * - Manages loading state and fade transitions internally
 */
const Canvas = ({
	children,
	containerClassName,
	theme = 'system',
	overlay,
	enableViewportRendering = true,
	loadingState = 'loading',
	onContainerChange,
	...props
}: CanvasComponentProps) => {
	const getInitialPageVisibility = () =>
		typeof document === 'undefined' ? true : !document.hidden

	const [isReady, setIsReady] = useState(false)
	// Starts sharp and steps down when the device cannot hold its refresh rate.
	// A caller that sets `dpr` takes the decision over entirely.
	const [dprCap, setDprCap] = useState(MAX_DPR)
	const adaptiveDpr = props.dpr === undefined
	const [canvasVisible, setCanvasVisible] = useState(false)
	const [isPageVisible, setIsPageVisible] = useState(getInitialPageVisibility)
	const mountedRef = useRef(false)
	const fadeFrameRef = useRef<number | null>(null)
	const fadeFrameNestedRef = useRef<number | null>(null)
	const [containerRef, isInViewport] = useViewportDetection(
		enableViewportRendering,
		{ rootMargin: '100% 0px' }
	)

	const setContainer = useCallback(
		(node: HTMLDivElement | null) => {
			containerRef.current = node
			onContainerChange?.(node)
		},
		[containerRef, onContainerChange]
	)

	// Handle StrictMode double-mounting
	useEffect(() => {
		if (!mountedRef.current) {
			mountedRef.current = true
			setIsReady(true)
		}

		return () => {
			mountedRef.current = false
		}
	}, [])

	// Determine rendering and visibility states.
	// isPageVisible intentionally excluded: hiding the tab should pause the render
	// loop (frameloop="never") rather than unmounting the canvas. Unmounting destroys
	// Three.js state — camera position, transition runtime, controls target — which
	// causes camera drift when the tab regains focus. isInViewport still gates the
	// full unmount because off-screen viewers should free the WebGL context.
	const shouldRenderCanvas = isReady && isInViewport
	const shouldShowCanvasContent = loadingState !== 'loading'

	useEffect(() => {
		if (typeof document === 'undefined') return

		const handleVisibilityChange = () => {
			setIsPageVisible(!document.hidden)
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [])

	const clearFadeFrames = () => {
		if (fadeFrameRef.current) {
			cancelAnimationFrame(fadeFrameRef.current)
			fadeFrameRef.current = null
		}

		if (fadeFrameNestedRef.current) {
			cancelAnimationFrame(fadeFrameNestedRef.current)
			fadeFrameNestedRef.current = null
		}
	}

	const scheduleCanvasFadeIn = () => {
		fadeFrameRef.current = requestAnimationFrame(() => {
			fadeFrameNestedRef.current = requestAnimationFrame(() => {
				setCanvasVisible(true)
			})
		})
	}

	// Trigger fade-in when canvas remounts after viewport change
	useEffect(() => {
		if (shouldRenderCanvas) {
			setCanvasVisible(false)
			scheduleCanvasFadeIn()

			return () => {
				clearFadeFrames()
			}
		} else {
			setCanvasVisible(false)
			clearFadeFrames()
		}
	}, [shouldRenderCanvas])

	return (
		<div
			ref={setContainer}
			className={cn('outline-none', containerClassName)}
			data-theme={theme}
			/*
			  Focusable, never tabbable. A click on the canvas focuses the viewer
			  rather than dropping focus to the page, so its keys (Escape out of a
			  hotspot's camera) keep working after an orbit; and a control that
			  removes itself has somewhere inside the viewer to hand focus to.
			*/
			tabIndex={-1}
		>
			{shouldRenderCanvas && (
				<ThreeCanvas
					{...props}
					dpr={props.dpr ?? [MIN_DPR, dprCap]}
					frameloop={!isPageVisible ? 'never' : (props.frameloop ?? 'demand')}
					className={cn(
						'h-full w-full opacity-0 transition-opacity ease-out',
						canvasVisible && shouldShowCanvasContent && 'opacity-100'
					)}
					style={{
						transitionDuration: `${VIEWER_MODEL_FADE_DURATION_MS}ms`
					}}
					data-canvas-visible={canvasVisible}
					data-loading-state={loadingState}
				>
					{adaptiveDpr && loadingState !== 'loading' && (
						<PerformanceMonitor
							// Remounts after every load; resume from the cap already reached.
							factor={(dprCap - MIN_DPR) / (MAX_DPR - MIN_DPR)}
							step={DPR_STEP / (MAX_DPR - MIN_DPR)}
							// Judged against the rate the device delivers, up to 60. Below it,
							// a loop capped at 30 (iOS Low Power Mode, an embed Safari has not
							// yet let run freely) would read as failing forever. Above it, the
							// rate comes from idle frames that draw nothing, and a steady 60
							// while orbiting on a 120Hz screen would read as failing too.
							bounds={(refreshRate) => {
								const target = Math.min(refreshRate, 60)
								return [target * 0.75, target * 0.95]
							}}
							// Lower only. A viewer at rest draws nothing, so its frames read
							// as fast whatever the device; following those back up would
							// resize every buffer at each pause and drop again on the next
							// orbit. Mounted only once loading is over, so decoding and shader
							// compiles are not mistaken for the device's pace.
							onChange={({ factor }) =>
								setDprCap((cap) =>
									Math.min(cap, MIN_DPR + (MAX_DPR - MIN_DPR) * factor)
								)
							}
						/>
					)}
					{children}
				</ThreeCanvas>
			)}

			{overlay}
		</div>
	)
}

export default Canvas
