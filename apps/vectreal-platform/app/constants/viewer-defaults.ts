import type {
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	NormalizationOptions,
	ShadowsProps
} from '@vctrl/core'

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
			initial: true
		}
	],
	sceneTransition: {
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
	scale: 1,
	color: '#000000',
	smooth: true
}

export const defaultNormalizationOptions: NormalizationOptions = {
	enabled: false,
	minSize: 0.5,
	maxSize: 5
}
