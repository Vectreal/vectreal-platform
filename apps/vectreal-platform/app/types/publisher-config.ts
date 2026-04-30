//// Process state
export type SidebarMode = 'optimize' | 'compose'
export type ComposeTool = 'environment' | 'shadow' | 'camera-controls'
export interface SceneMetaState {
	name: string
	description: string
	thumbnailUrl: string
}
export interface ProcessState {
	step: 'uploading' | 'preparing'
	mode: SidebarMode
	activeComposeTool: ComposeTool
	showSidebar: boolean
	showPublishPanel: boolean
	isInitializing: boolean
	isLoading: boolean
	isSaving: boolean
	hasUnsavedChanges: boolean
}
