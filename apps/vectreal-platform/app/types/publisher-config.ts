//// Process state
export type SidebarMode = 'optimize' | 'compose'

/**
 * Scene-level compose tools (left sidebar).
 */
export type ComposeTool =
	| 'environment'
	| 'shadow'
	| 'camera-tools'
	| 'hotspots'
	| 'assets'

/**
 * Object-level tools rendered as a stacked panel set below scene tools.
 */
export type ObjectTool = 'object-list' | 'object-overrides' | 'placeables'

/**
 * Top-level grouping of the left-sidebar tool stack.
 * 'scene' shows ComposeTool panels; 'object' shows ObjectTool panels.
 */
export type SidebarGroup = 'scene' | 'object'

export interface SceneMetaState {
	name: string
	description: string
	thumbnailUrl: string
}
export interface ProcessState {
	step: 'uploading' | 'preparing'
	mode: SidebarMode
	/** Active scene-level tool. */
	activeComposeTool: ComposeTool
	/** Active object-level tool. Relevant when activeSidebarGroup === 'object'. */
	activeObjectTool: ObjectTool
	/** Which tool group is currently active in the left sidebar. */
	activeSidebarGroup: SidebarGroup
	showSidebar: boolean
	showPublishPanel: boolean
	isInitializing: boolean
	isLoading: boolean
	isSaving: boolean
	hasUnsavedChanges: boolean
}
