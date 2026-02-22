//// Process state
export type SidebarMode = 'optimize' | 'compose' | 'publish'
export interface ProcessState {
	step: 'uploading' | 'preparing' | 'publishing'
	mode: SidebarMode
	showSidebar: boolean
	showInfo: boolean
	isInitializing: boolean
	isLoading: boolean
	isSaving: boolean
	hasUnsavedChanges: boolean
}
