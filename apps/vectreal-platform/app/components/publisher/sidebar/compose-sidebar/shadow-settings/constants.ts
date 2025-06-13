export const ACCUMULATIVE_FIELDS = [
	{
		key: 'frames',
		label: 'Frames',
		min: 1,
		max: 200,
		step: 1,
		tooltip: 'Number of frames to accumulate for soft shadows.'
	},
	{
		key: 'alphaTest',
		label: 'Alpha Test',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip: 'Alpha test threshold for shadow transparency.'
	},
	{
		key: 'scale',
		label: 'Shadow Scale',
		min: 0.1,
		max: 100,
		step: 1,
		tooltip: 'Overall scale of the shadow area.'
	},
	{
		key: 'resolution',
		label: 'Resolution',
		min: 128,
		max: 4096,
		step: 128,
		tooltip: 'Shadow map resolution.'
	},
	{
		key: 'colorBlend',
		label: 'Color Blend',
		min: 0,
		max: 10,
		step: 0.1,
		tooltip: 'How much the shadow color blends with the scene.'
	},
	{
		key: 'opacity',
		label: 'Opacity',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip: 'Shadow opacity.'
	}
]

export const ACCUMULATIVE_LIGHT_FIELDS = [
	{
		key: 'intensity',
		label: 'Light Intensity',
		min: 0,
		max: 10,
		step: 0.01,
		tooltip: 'Strength of the shadow-casting light.'
	},
	{
		key: 'amount',
		label: 'Light Amount',
		min: 1,
		max: 32,
		step: 1,
		tooltip: 'Number of lights used for soft shadows.'
	},
	{
		key: 'radius',
		label: 'Light Radius',
		min: 0,
		max: 50,
		step: 0.1,
		tooltip: 'Radius of the light source.'
	},
	{
		key: 'ambient',
		label: 'Ambient',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip: 'Ambient light contribution.'
	}
]

export const CONTACT_FIELDS = [
	{
		key: 'opacity',
		label: 'Opacity',
		min: 0,
		max: 1,
		step: 0.01,
		tooltip: 'Shadow opacity.'
	},
	{
		key: 'blur',
		label: 'Blur',
		min: 0,
		max: 10,
		step: 0.1,
		tooltip: 'Shadow blur amount.'
	},
	{
		key: 'scale',
		label: 'Shadow Scale',
		min: 0.1,
		max: 100,
		step: 1,
		tooltip: 'Overall scale of the shadow area.'
	},
	{
		key: 'width',
		label: 'Shadow Width',
		min: 0.1,
		max: 10,
		step: 0.1,
		tooltip: 'Width of the shadow area.'
	},
	{
		key: 'height',
		label: 'Shadow Height',
		min: 0.1,
		max: 10,
		step: 0.1,
		tooltip: 'Height of the shadow area.'
	},
	{
		key: 'near',
		label: 'Near',
		min: 0,
		max: 10,
		step: 0.01,
		tooltip: 'Near clipping plane for shadow.'
	},
	{
		key: 'far',
		label: 'Far',
		min: 0,
		max: 100,
		step: 0.1,
		tooltip: 'Far clipping plane for shadow.'
	},
	{
		key: 'resolution',
		label: 'Resolution',
		min: 128,
		max: 4096,
		step: 128,
		tooltip: 'Shadow map resolution.'
	}
]
