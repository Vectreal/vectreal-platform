import { valueMappings } from '@shared/utils'

import {
	defaultCameraOptions,
	defaultControlsOptions
} from '../../../../../constants/viewer-defaults'

import type { FieldConfig } from '../../../../../types/settings-field'

/**
 * Camera controls field configurations
 * Using defaults from defaultControlsOptions
 */
export const CAMERA_CONTROLS_FIELDS: FieldConfig[] = [
	{
		key: 'autoRotateSpeed',
		label: 'Rotation Speed',
		min: 0.1,
		max: 10,
		step: 0.1,
		formatValue: (value) => value.toFixed(1),
		valueMapping: valueMappings.quadratic
	},
	{
		key: 'dampingFactor',
		label: 'Responsiveness',
		min: 0.02,
		max: 1,
		step: 0.01,
		formatValue: (value) => value.toFixed(2)
	},
	{
		key: 'zoomSpeed',
		label: 'Zoom Speed',
		min: 0.1,
		max: 5,
		step: 0.1,
		formatValue: (value) => value.toFixed(1),
		valueMapping: valueMappings.quadratic
	},
	{
		key: 'rotateSpeed',
		label: 'Orbit Speed',
		min: 0.1,
		max: 3,
		step: 0.05,
		formatValue: (value) => value.toFixed(2)
	},
	{
		key: 'panSpeed',
		label: 'Pan Speed',
		min: 0.1,
		max: 3,
		step: 0.05,
		formatValue: (value) => value.toFixed(2)
	},
	{
		key: 'maxPolarAngle',
		label: 'Vertical Limit',
		min: 0,
		max: Math.PI,
		step: 0.01,
		formatValue: (value) => `${((value * 180) / Math.PI).toFixed(0)}°`
	}
]

/**
 * Default values from viewer package
 * Re-exported for convenience
 */
export { defaultCameraOptions, defaultControlsOptions }
