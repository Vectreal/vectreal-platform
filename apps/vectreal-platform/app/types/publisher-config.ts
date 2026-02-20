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
