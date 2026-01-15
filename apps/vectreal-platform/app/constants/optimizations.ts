import type { Optimizations } from 'packages/core/src/types/scene-types'

import type { OptimizationPreset } from '../types/publisher-config'

export const lowPreset: Optimizations = {
	simplification: {
		name: 'simplification',
		enabled: true,
		ratio: 0.8,
		error: 0.001
	},
	texture: {
		name: 'texture',
		enabled: true,
		resize: [2048, 2048],
		quality: 90,
		targetFormat: 'webp',
		serverOptions: {
			enabled: true
		}
	},
	quantize: {
		name: 'quantize',
		enabled: true
	},
	dedup: {
		name: 'dedup',
		enabled: false
	},
	normals: {
		name: 'normals',
		enabled: false
	}
}

export const mediumPreset: Optimizations = {
	simplification: {
		name: 'simplification',
		enabled: true,
		ratio: 0.6,
		error: 0.005
	},
	texture: {
		name: 'texture',
		enabled: true,
		resize: [1024, 1024],
		quality: 80,
		targetFormat: 'webp',
		serverOptions: {
			enabled: true
		}
	},
	quantize: {
		name: 'quantize',
		enabled: true
	},
	dedup: {
		name: 'dedup',
		enabled: false
	},
	normals: {
		name: 'normals',
		enabled: false
	}
}

export const highPreset: Optimizations = {
	simplification: {
		name: 'simplification',
		enabled: true,
		ratio: 0.5,
		error: 0.01
	},
	texture: {
		name: 'texture',
		enabled: true,
		resize: [512, 512],
		quality: 70,
		targetFormat: 'webp',
		serverOptions: {
			enabled: true
		}
	},
	quantize: {
		name: 'quantize',
		enabled: true
	},
	dedup: {
		name: 'dedup',
		enabled: true
	},
	normals: {
		name: 'normals',
		enabled: false
	}
}

export const optimizationPresets: Record<OptimizationPreset, Optimizations> = {
	low: lowPreset,
	medium: mediumPreset,
	high: highPreset
}
