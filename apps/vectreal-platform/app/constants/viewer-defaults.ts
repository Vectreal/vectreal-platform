import {
	NORMALIZATION_DEFAULT_MAX_SIZE,
	NORMALIZATION_DEFAULT_MIN_SIZE
} from '@vctrl/core'

import type {
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	NormalizationOptions,
	ScenePresentationSettings,
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
	// Linear rather than object avoidance. The avoidance path solves a curve
	// around the model and still produces unpredictable framing on some scenes,
	// so it is opt-in from the camera panel instead of the default everyone gets.
	sceneTransition: {
		type: 'linear',
		duration: 1000,
		easing: 'ease_in_out'
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

/*
  Shown by default. Every scene saved before the `presentation` column existed
  reads back as `undefined` here, and those scenes already draw the popover, so
  the default that changes nothing for them is the only correct one. The
  publisher toggle is an opt-out.
*/
export const defaultPresentationOptions: ScenePresentationSettings = {
	showInfoPopover: true
}

export const defaultEnvOptions: EnvironmentProps = {
	preset: 'studio-natural',
	background: false,
	backgroundIntensity: 1,
	environmentIntensity: 1,
	environmentResolution: '1k',
	backgroundBlurriness: 0.5
}

export const defaultShadowsOptions: ShadowsProps = {
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
 * Shadow settings as they may appear in a stored scene. Scenes saved before
 * shadows collapsed to a single configuration carry a `type` tag; current saves
 * carry none. (`ShadowsProps` inherits an unrelated `type` from three's
 * `Object3D` via drei, so the legacy tag is spelled out here rather than
 * borrowed from it.)
 */
type StoredShadowSettings = Partial<Omit<ShadowsProps, 'type'>> & {
	/** `'accumulative'` or `'contact'` on legacy rows, absent on current saves. */
	type?: string
}

/**
 * Coerces stored shadow settings into a valid config, merging over the defaults
 * so a partial save still fills in any missing fields.
 *
 * A legacy `'contact'` tag described a mode the viewer no longer has, so only
 * its enabled flag survives. The tag itself is dropped either way.
 */
export const normalizeShadowOptions = (
	stored?: StoredShadowSettings
): ShadowsProps => {
	if (!stored || stored.type === 'contact') {
		return {
			...defaultShadowsOptions,
			enabled: stored?.enabled ?? defaultShadowsOptions.enabled
		}
	}

	const { type: _legacyType, ...settings } = stored

	return {
		...defaultShadowsOptions,
		...settings,
		light: { ...defaultShadowsOptions.light, ...settings.light },
		contact: { ...defaultShadowsOptions.contact, ...settings.contact }
	}
}

// Bounds come from `@vctrl/core` rather than being restated here. The publisher
// computes the scale change it has to move hotspots by, and the viewer computes
// the scale it actually applies; a second copy of these numbers would let the
// two disagree, and every marker in an extreme-size scene would drift off the
// model by the difference.
export const defaultNormalizationOptions: Required<NormalizationOptions> = {
	enabled: false,
	minSize: NORMALIZATION_DEFAULT_MIN_SIZE,
	maxSize: NORMALIZATION_DEFAULT_MAX_SIZE
}
