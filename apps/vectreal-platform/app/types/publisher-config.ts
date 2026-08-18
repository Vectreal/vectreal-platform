//// Process state
export type SidebarMode = 'optimize' | 'compose'
export type ComposeTool =
	| 'environment'
	| 'shadow'
	| 'camera-controls'
	| 'interaction-controls'
	| 'hotspots'
export interface SceneMetaState {
	name: string
	description: string
	thumbnailUrl: string
}
export interface ProcessState {
	mode: SidebarMode
	activeComposeTool: ComposeTool
	showSidebar: boolean
	showPublishPanel: boolean
	isSaving: boolean
	hasUnsavedChanges: boolean
}
