import { atom } from 'jotai'
import { createStore } from 'jotai/vanilla'

export interface DashboardContentRowSelection {
	id: string
	type: 'scene' | 'folder'
	name: string
	projectId: string
	folderId?: string | null
}

export interface DashboardTableState {
	search: string
	pageIndex: number
	pageSize: number
	sortBy: string | null
	sortDirection: 'asc' | 'desc' | null
}

export interface DashboardCreateFolderDialogState {
	open: boolean
	projectId: string
	parentFolderId: string | null
	name: string
	description: string
}

export interface DashboardRenameDialogState {
	open: boolean
	item: DashboardContentRowSelection | null
	name: string
}

export interface DashboardDeleteDialogState {
	open: boolean
	items: DashboardContentRowSelection[]
}

const defaultTableState: DashboardTableState = {
	search: '',
	pageIndex: 0,
	pageSize: 10,
	sortBy: null,
	sortDirection: null
}

const defaultCreateFolderDialogState: DashboardCreateFolderDialogState = {
	open: false,
	projectId: '',
	parentFolderId: null,
	name: '',
	description: ''
}

const defaultRenameDialogState: DashboardRenameDialogState = {
	open: false,
	item: null,
	name: ''
}

const defaultDeleteDialogState: DashboardDeleteDialogState = {
	open: false,
	items: []
}

const selectedRowsAtom = atom<DashboardContentRowSelection[]>([])
const createFolderDialogAtom = atom<DashboardCreateFolderDialogState>(
	defaultCreateFolderDialogState
)
const renameDialogAtom = atom<DashboardRenameDialogState>(
	defaultRenameDialogState
)
const deleteDialogAtom = atom<DashboardDeleteDialogState>(
	defaultDeleteDialogState
)
const tableStatesAtom = atom<Record<string, DashboardTableState>>({})

const dashboardManagementStore = createStore()

dashboardManagementStore.set(selectedRowsAtom, [])
dashboardManagementStore.set(
	createFolderDialogAtom,
	defaultCreateFolderDialogState
)
dashboardManagementStore.set(renameDialogAtom, defaultRenameDialogState)
dashboardManagementStore.set(deleteDialogAtom, defaultDeleteDialogState)
dashboardManagementStore.set(tableStatesAtom, {})

export {
	defaultTableState,
	selectedRowsAtom,
	createFolderDialogAtom,
	renameDialogAtom,
	deleteDialogAtom,
	tableStatesAtom,
	dashboardManagementStore
}
