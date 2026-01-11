import { CanvasProps, Canvas as ThreeCanvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'

import { useViewerLoading } from '../hooks/use-viewer-loading'
import { useViewportDetection } from '../hooks/use-viewport-detection'

import styles from './canvas.module.css'

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
	 * Whether the viewer has content to display (model or children)
	 */
	hasContent: boolean
	/**
	 * JSX element to render while loading
	 */
	loader?: React.ReactNode
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
}

/**
 * An enhanced wrapper around react-three/fiber Canvas that:
 * - Wraps the entire viewer (container + canvas + loader + overlays)
 * - Handles StrictMode double-mounting gracefully
 * - Prevents rendering when outside viewport (optional)
 * - Manages loading state and fade transitions internally
 */
export const Canvas = ({
	children,
	containerClassName,
	theme = 'system',
	hasContent,
	loader,
	overlay,
	enableViewportRendering = true,
	...props
}: CanvasComponentProps) => {
	const [isReady, setIsReady] = useState(false)
	const [canvasVisible, setCanvasVisible] = useState(false)
	const mountedRef = useRef(false)
	const [containerRef, isInViewport] = useViewportDetection(
		enableViewportRendering
	)

	// Manage loading state internally
	const loadingState = useViewerLoading(hasContent)

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
	const shouldRenderCanvas = isReady && isInViewport

	// Trigger fade-in when canvas remounts after viewport change
	useEffect(() => {
		if (shouldRenderCanvas && loadingState !== 'loading') {
			// Trigger fade-in after a brief delay to ensure CSS transition runs
			const timer = setTimeout(() => {
				setCanvasVisible(true)
			}, 10)

			return () => clearTimeout(timer)
		} else {
			setCanvasVisible(false)
		}
	}, [shouldRenderCanvas, loadingState])

	const showLoader = loadingState !== 'ready'

	return (
		<div ref={containerRef} className={containerClassName} data-theme={theme}>
			{shouldRenderCanvas && (
				<ThreeCanvas
					{...props}
					className={styles.canvas}
					data-canvas-visible={canvasVisible}
				>
					{children}
				</ThreeCanvas>
			)}

			{showLoader && loader && (
				<div
					className={styles['loader-container']}
					data-loading-state={loadingState}
				>
					{loader}
				</div>
			)}

			{overlay}
		</div>
	)
}
