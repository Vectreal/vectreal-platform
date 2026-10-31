//// Process state
export type SidebarMode = 'optimize' | 'compose'
export type ComposeTool =
	| 'lighting'
	| 'camera-controls'
	| 'interaction-controls'
	| 'hotspots'
	| 'animation'
export interface SceneMetaState {
	name: string
	description: string
	thumbnailUrl: string
}
/**
 * The frame an in-memory thumbnail capture painted, as a
 * `buildThumbnailFrameSignature`. Keyed by the capture itself, so a record
 * left over from an earlier capture describes nothing.
 */
export interface CapturedThumbnailFrame {
	thumbnailUrl: string
	frame: string
}
export interface ProcessState {
	mode: SidebarMode
	activeComposeTool: ComposeTool
	showSidebar: boolean
	showPublishPanel: boolean
	isSaving: boolean
	hasUnsavedChanges: boolean
}
