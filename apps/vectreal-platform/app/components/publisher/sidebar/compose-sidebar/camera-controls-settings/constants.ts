import {
	defaultCameraOptions,
	defaultControlsOptions
} from '../../../../../constants/viewer-defaults'

import {
	ValueMapping,
	valueMappings
} from '../../../../../lib/utils/value-mapping'

/**
 * Camera and controls field configurations
 * Based on defaults from @vctrl/viewer package
 *
 * Following React best practices:
 * - rendering-hoist-jsx: Static configuration hoisted outside component
 * - js-cache-property-access: Centralized field definitions
 */

export interface FieldConfig {
	key: string
	label: string
	min: number
	max: number
	step: number
	tooltip: string
	formatValue?: (value: number) => string
	valueMapping?: ValueMapping
	unit?: string
}

/**
 * Camera controls field configurations
 * Using defaults from defaultControlsOptions
 */
export const CAMERA_CONTROLS_FIELDS: FieldConfig[] = [
	{
		key: 'autoRotateSpeed',
		label: 'Auto Rotate Speed',
		min: 0.1,
		max: 10,
		step: 0.1,
		tooltip: 'Speed at which the camera auto-rotates.',
		formatValue: (value) => value.toFixed(1),
		valueMapping: valueMappings.quadratic
	},
	{
		key: 'dampingFactor',
		label: 'Damping Factor',
		min: 0.01,
		max: 1,
		step: 0.01,
		tooltip:
			'Smoothness of camera movement. Lower values = smoother, more damped movement.',
		formatValue: (value) => value.toFixed(2)
	},
	{
		key: 'zoomSpeed',
		label: 'Zoom Speed',
		min: 0.1,
		max: 5,
		step: 0.1,
		tooltip: 'Speed at which zooming in/out occurs.',
		formatValue: (value) => value.toFixed(1),
		valueMapping: valueMappings.quadratic
	},
	{
		key: 'rotateSpeed',
		label: 'Rotate Speed',
		min: 0.1,
		max: 3,
		step: 0.1,
		tooltip: 'Speed of manual camera rotation.',
		formatValue: (value) => value.toFixed(1)
	},
	{
		key: 'panSpeed',
		label: 'Pan Speed',
		min: 0.1,
		max: 3,
		step: 0.1,
		tooltip: 'Speed of camera panning.',
		formatValue: (value) => value.toFixed(1)
	},
	{
		key: 'maxPolarAngle',
		label: 'Max Polar Angle',
		min: 0,
		max: Math.PI,
		step: 0.01,
		tooltip:
			'Maximum vertical rotation angle. PI/2 prevents looking below the horizon.',
		formatValue: (value) => `${((value * 180) / Math.PI).toFixed(0)}°`
	}
]

/**
 * Camera field configurations
 */
export const CAMERA_FIELDS: FieldConfig[] = [
	{
		key: 'fov',
		label: 'Field of View',
		min: 20,
		max: 120,
		step: 1,
		tooltip: 'Camera field of view in degrees.',
		formatValue: (value) => `${value.toFixed(0)}°`
	},
	{
		key: 'near',
		label: 'Near Plane',
		min: 0.001,
		max: 10,
		step: 0.001,
		tooltip: 'Near clipping plane distance.',
		formatValue: (value) => value.toFixed(3),
		valueMapping: valueMappings.log
	},
	{
		key: 'far',
		label: 'Far Plane',
		min: 10,
		max: 10000,
		step: 10,
		tooltip: 'Far clipping plane distance.',
		formatValue: (value) => value.toFixed(0),
		valueMapping: valueMappings.log
	}
]

/**
 * Default values from viewer package
 * Re-exported for convenience
 */
export { defaultCameraOptions, defaultControlsOptions }
