import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { ControlsProps } from '@vctrl/core'
import {
	memo,
	useCallback,
	useEffect,
	useRef,
	useState,
	type ComponentRef
} from 'react'

import { prefersReducedMotion } from './reduced-motion'

/** Where the orbit camera looks from, in the lights' terms (degrees). */
export interface ViewerView {
	/** Around the vertical axis; 0 looks from +Z, 90 from +X. */
	azimuth: number
	/** Above the horizon; 90 looks straight down. */
	elevation: number
}

interface SceneControlsProps extends ControlsProps {
	enabledOverride?: boolean | null
	/**
	 * Visitors cannot move the camera yet (the scene waits for a tap), while
	 * auto-rotate keeps turning it. Touches and the wheel go to the page.
	 */
	inputLocked?: boolean
	onViewChange?: (view: ViewerView) => void
}

const RADIANS = Math.PI / 180
/** Smaller turns are not reported, so a drag does not flood the listener. */
const VIEW_STEP = 0.5

export const defaultControlsOptions = {
	controlsTimeout: 0,
	maxPolarAngle: Math.PI / 2,
	autoRotate: false,
	autoRotateSpeed: 0.25,
	enableZoom: true,
	zoomSpeed: 0.4,
	panSpeed: 0.5,
	rotateSpeed: 0.5,
	enableDamping: false,
	dampingFactor: 0.12,
	makeDefault: true
} satisfies ControlsProps

/**
 * SceneControls component that enables orbit controls after a specified timeout.
 */
const SceneControls = memo((props: SceneControlsProps) => {
	const {
		controlsTimeout,
		focusOnDoubleClick: _viewerOwnsDoubleClick,
		onViewChange,
		onChange,
		enabledOverride,
		inputLocked = false,
		...rest
	} = {
		...defaultControlsOptions,
		...props,
		// A model turning by itself is motion the visitor did not start.
		autoRotate: props.autoRotate === true && !prefersReducedMotion()
	}

	const mountedRef = useRef(false)
	const [isControlsEnabled, setIsControlsEnabled] = useState(
		controlsTimeout === 0
	)

	useEffect(() => {
		if (mountedRef.current) return
		mountedRef.current = true

		return () => {
			mountedRef.current = false
		}
	}, [mountedRef])

	useEffect(() => {
		if (!controlsTimeout) return

		const timeoutId = setTimeout(() => {
			setIsControlsEnabled(true)
		}, controlsTimeout)

		return () => clearTimeout(timeoutId)
	}, [controlsTimeout])

	const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
	const reportedRef = useRef<ViewerView | null>(null)
	const reportView = useCallback(() => {
		const controls = controlsRef.current
		if (!controls || !onViewChange) return
		const view = {
			azimuth: controls.getAzimuthalAngle() / RADIANS,
			elevation: 90 - controls.getPolarAngle() / RADIANS
		}
		const reported = reportedRef.current
		if (
			reported &&
			Math.abs(view.azimuth - reported.azimuth) < VIEW_STEP &&
			Math.abs(view.elevation - reported.elevation) < VIEW_STEP
		)
			return
		reportedRef.current = view
		onViewChange(view)
	}, [onViewChange])

	// The view it opens on, and again for a new listener, which has seen none.
	useEffect(() => {
		reportedRef.current = null
		reportView()
	}, [reportView])

	// A consumer's own `onChange` still runs: the report rides along with it.
	const handleChange = useCallback(
		(event?: Parameters<NonNullable<typeof onChange>>[0]) => {
			onChange?.(event)
			reportView()
		},
		[onChange, reportView]
	)

	const enabled = enabledOverride ?? isControlsEnabled
	const takesInput = enabled && !inputLocked

	/*
	  drei updates the controls only while they are enabled, and a locked scene
	  disables them, so its auto-rotate is stepped here. `update` turns the
	  camera whatever `enabled` says.
	*/
	useFrame(() => {
		const controls = controlsRef.current
		if (inputLocked && enabled && controls?.autoRotate) controls.update()
	})

	/*
	  OrbitControls claims every touch on the element it connects to
	  (`touch-action: none`), claims it again on every reconnect, and keeps the
	  claim while disabled, so a host that turns the controls off to drive the
	  camera itself still trapped the page's scroll. Controls that turn nothing
	  hand the touch back, on whichever element drei connected them to.
	*/
	const connectedElement = useThree((state) => state.events.connected)
	useEffect(() => {
		const element = controlsRef.current?.domElement
		if (element) element.style.touchAction = takesInput ? 'none' : ''
	}, [takesInput, connectedElement])

	return (
		<OrbitControls
			ref={controlsRef}
			enabled={enabled}
			{...rest}
			{...(inputLocked ? { enabled: false } : {})}
			onChange={handleChange}
		/>
	)
})
export default SceneControls
