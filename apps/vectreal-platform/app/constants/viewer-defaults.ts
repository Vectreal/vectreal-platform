import type {
	AccumulativeShadowsProps,
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	ShadowsProps
} from '@vctrl/core'
import type { Vector3Tuple } from 'three'

export const defaultBoundsOptions: BoundsProps = {
	fit: true,
	clip: true,
	margin: 1.5,
	maxDuration: 0
}

export const defaultCameraOptions: CameraProps = {
	activeCameraId: 'default',
	cameras: [
		{
			cameraId: 'default',
			name: 'Default Camera',
			fov: 60,
			initial: true,
			transition: {
				type: 'object_avoidance',
				duration: 1000,
				easing: 'ease_in_out',
				objectAvoidance: {
					clearance: 2,
					arcHeight: 2,
					samples: 64,
					tension: 0.5
				}
			}
		}
	]
}
export const defaultControlsOptions: ControlsProps = {
	controlsTimeout: 0,
	maxPolarAngle: Math.PI / 2,
	autoRotate: false,
	autoRotateSpeed: 0.25,
	enableZoom: true,
	zoomSpeed: 0.4,
	panSpeed: 0.5,
	rotateSpeed: 0.5,
	enableDamping: true,
	dampingFactor: 0.2,
	makeDefault: true
}

export const defaultEnvOptions: EnvironmentProps = {
	preset: 'studio-natural',
	background: false,
	backgroundIntensity: 1,
	environmentIntensity: 1,
	environmentResolution: '1k',
	backgroundBlurriness: 0.5
}

export const defaultShadowOptions: ShadowsProps = {
	type: 'contact',
	enabled: false,
	opacity: 0.4,
	blur: 0.1,
	scale: 5,
	color: '#000000',
	smooth: true
}

export const defaultAccumulativeShadowsOptions: AccumulativeShadowsProps = {
	type: 'accumulative',
	enabled: false,
	temporal: false,
	frames: 30,
	alphaTest: 0.35,
	opacity: 1,
	scale: 10,
	resolution: 1024,
	colorBlend: 2,
	color: '#000000',
	light: {
		intensity: 1,
		amount: 5,
		radius: 7.5,
		ambient: 0.5,
		position: [5, 10, 5] as Vector3Tuple
	}
}
