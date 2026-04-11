import { CanvasProps, Canvas as ThreeCanvas } from '@react-three/fiber'
import { cn } from '@shared/utils'
import { useEffect, useRef, useState } from 'react'

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
}

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
	...props
}: CanvasComponentProps) => {
	const getInitialPageVisibility = () =>
		typeof document === 'undefined' ? true : !document.hidden

	const [isReady, setIsReady] = useState(false)
	const [canvasVisible, setCanvasVisible] = useState(false)
	const [isPageVisible, setIsPageVisible] = useState(getInitialPageVisibility)
	const mountedRef = useRef(false)
	const fadeFrameRef = useRef<number | null>(null)
	const fadeFrameNestedRef = useRef<number | null>(null)
	const [containerRef, isInViewport] = useViewportDetection(
		enableViewportRendering,
		{ rootMargin: '100% 0px' }
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

	// Determine rendering and visibility states
	const shouldRenderCanvas = isReady && isInViewport && isPageVisible
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
		<div ref={containerRef} className={containerClassName} data-theme={theme}>
			{shouldRenderCanvas && (
				<ThreeCanvas
					{...props}
					dpr={props.dpr ?? [1, 1.5]}
					frameloop={props.frameloop ?? 'demand'}
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
					{children}
				</ThreeCanvas>
			)}

			{overlay}
		</div>
	)
}

export default Canvas
