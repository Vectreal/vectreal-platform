import { OrbitControls } from '@react-three/drei'
import { ControlsProps } from '@vctrl/core'
import {
	memo,
	useCallback,
	useEffect,
	useRef,
	useState,
	type ComponentRef
} from 'react'

/** Where the orbit camera looks from, in the lights' terms (degrees). */
export interface ViewerView {
	/** Around the vertical axis; 0 looks from +Z, 90 from +X. */
	azimuth: number
	/** Above the horizon; 90 looks straight down. */
	elevation: number
}

interface SceneControlsProps extends ControlsProps {
	enabledOverride?: boolean | null
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
	const { controlsTimeout, onViewChange, onChange, enabledOverride, ...rest } =
		{
			...defaultControlsOptions,
			...props
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

	return (
		<OrbitControls
			ref={controlsRef}
			enabled={enabledOverride ?? isControlsEnabled}
			{...rest}
			onChange={handleChange}
		/>
	)
})
export default SceneControls
