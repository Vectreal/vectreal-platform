import type {
	AccumulativeShadowsProps,
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

export const defaultShadowOptions: AccumulativeShadowsProps = {
	type: 'accumulative',
	enabled: false,
	temporal: true,
	// Fewer frames settle faster / appear sooner (see scene-shadows.tsx).
	frames: 48,
	// alphaTest is the transient/fallback cutoff used while the bake ramps; once it
	// settles the viewer auto-calibrates it to the measured lit-plane brightness.
	alphaTest: 3.0,
	// Manual trim on that auto cutoff (1 = pure auto). Surfaced as Advanced "Cutoff".
	cutoffScale: 1,
	opacity: 0.9,
	// Tight to the model footprint so the shadow stays crisp (see scene-shadows.tsx).
	scale: 2.5,
	resolution: 1024,
	colorBlend: 2,
	color: '#000000',
	// Screen-space crevice occlusion (N8AO). Opt-in: real-time SSAO runs every
	// rendered frame, so the default is the zero-idle-cost baked shadow only.
	ao: false,
	aoIntensity: 1.4,
	// Soft contact/ground shadow (drei ContactShadows) approximating ground AO.
	// Opt-in; baked once. Tuned via blur (softness) and opacity (darkness).
	contact: {
		enabled: false,
		opacity: 0.6,
		blur: 3,
		scale: 1.5,
		reach: 0.35
	},
	light: {
		intensity: Math.PI * 2,
		amount: 8,
		// Penumbra softness, in model-size units.
		radius: 0.8,
		// Hemisphere fill fraction — surfaced as "Darkness" (less fill = darker).
		ambient: 0.3,
		// Straight overhead by default — minimal initial shadow (see scene-shadows.tsx).
		position: [0, 2.5, 0],
		bias: 0.001
	}
}

/**
 * Coerces stored shadow settings to a valid accumulative config. Contact shadows
 * are now an internal animating-only fallback (never user-selected), so legacy
 * `contact` or partial configs are normalized to the accumulative defaults while
 * preserving `enabled`. Accumulative configs are merged over the defaults so a
 * partial save still fills in any missing fields.
 */
export const normalizeShadowOptions = (stored?: ShadowsProps): ShadowsProps => {
	if (stored?.type === 'accumulative') {
		return {
			...defaultShadowOptions,
			...stored,
			light: { ...defaultShadowOptions.light, ...stored.light },
			contact: { ...defaultShadowOptions.contact, ...stored.contact }
		}
	}

	return {
		...defaultShadowOptions,
		enabled: stored?.enabled ?? defaultShadowOptions.enabled
	}
}

export const defaultNormalizationOptions: Required<NormalizationOptions> = {
	enabled: false,
	minSize: 0.5,
	maxSize: 5
}
