import {
	type DedupOptions,
	type NormalsOptions,
	type QuantizeOptions,
	type SimplifyOptions,
	type TextureCompressOptions
} from '@vctrl/core'

//// Process state
export type SidebarMode = 'optimize' | 'compose' | 'publish'
export interface ProcessState {
	step: 'uploading' | 'preparing' | 'publishing'
	mode: SidebarMode
	showSidebar: boolean
	showInfo: boolean
	isLoading: boolean
	isInitializing: boolean
	hasUnsavedChanges: boolean
}

//// Optimization state
export type OptimizationNames =
	| 'simplification'
	| 'texture'
	| 'quantize'
	| 'dedup'
	| 'normals'

interface BaseOptimization<Name = OptimizationNames> {
	name: Name
	enabled: boolean
}

export interface SimplificationOptimization
	extends BaseOptimization<'simplification'>,
		SimplifyOptions {}

export interface TextureOptimization
	extends BaseOptimization<'texture'>,
		TextureCompressOptions {}

export interface QuantizeOptimization
	extends BaseOptimization<'quantize'>,
		QuantizeOptions {}

export interface DedupOptimization
	extends BaseOptimization<'dedup'>,
		DedupOptions {}

export interface NormalsOptimization
	extends BaseOptimization<'normals'>,
		NormalsOptions {}

export type PossibleOptimizations = {
	simplification: SimplificationOptimization
	texture: TextureOptimization
	quantize: QuantizeOptimization
	dedup: DedupOptimization
	normals: NormalsOptimization
}

export type OptimizationPreset = 'low' | 'medium' | 'high'

export interface OptimizationState {
	plannedOptimizations: PossibleOptimizations
	optimizationPreset: OptimizationPreset
}
