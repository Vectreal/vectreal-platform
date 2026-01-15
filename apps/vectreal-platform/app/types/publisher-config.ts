import { Optimizations } from 'packages/core/src/types/scene-types'

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

export type OptimizationPreset = 'low' | 'medium' | 'high'

export interface OptimizationState {
	optimizations: Optimizations
	optimizationPreset: OptimizationPreset
}
