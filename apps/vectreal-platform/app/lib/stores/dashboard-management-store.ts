import { atom } from 'jotai'
import { createStore } from 'jotai/vanilla'

import type { DashboardEntityRef } from '../domain/dashboard/dashboard-confirmation'

export interface DashboardCreateFolderDialogState {
	open: boolean
	projectId: string
	parentFolderId: string | null
	name: string
	description: string
}

export interface DashboardRenameDialogState {
	open: boolean
	item: DashboardEntityRef | null
	name: string
}

export interface DashboardDeleteDialogState {
	open: boolean
	items: DashboardEntityRef[]
}

export interface DashboardMoveDialogState {
	open: boolean
	items: DashboardEntityRef[]
	/** The project the move is confined to; moves never cross projects. */
	projectId: string | null
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

const defaultMoveDialogState: DashboardMoveDialogState = {
	open: false,
	items: [],
	projectId: null
}

const selectedRowsAtom = atom<DashboardEntityRef[]>([])
const createFolderDialogAtom = atom<DashboardCreateFolderDialogState>(
	defaultCreateFolderDialogState
)
const renameDialogAtom = atom<DashboardRenameDialogState>(
	defaultRenameDialogState
)
const deleteDialogAtom = atom<DashboardDeleteDialogState>(
	defaultDeleteDialogState
)
const moveDialogAtom = atom<DashboardMoveDialogState>(defaultMoveDialogState)

const dashboardManagementStore = createStore()

export {
	selectedRowsAtom,
	createFolderDialogAtom,
	renameDialogAtom,
	deleteDialogAtom,
	moveDialogAtom,
	dashboardManagementStore
}
