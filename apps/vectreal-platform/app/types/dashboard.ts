/**
 * Dashboard Layout Types
 * @description Type definitions for the dashboard layout components
 */

export enum ACTION_VARIANT {
	CREATE_PROJECT = 'create-project',
	PROJECT_LIST = 'projects-list',
	PROJECT_DETAIL = 'project-detail',
	FOLDER_DETAIL = 'folder-detail',
	SCENE_DETAIL = 'scene-detail',
	DASHBOARD = 'dashboard'
}

export type DashboardView =
	| 'projects'
	| 'organizations'
	| 'settings'
	| 'dashboard'

export interface TitleContent {
	title: string
	description: string
}

export interface DynamicHeaderContent {
	title: string
	description: string
	actionVariant?: ACTION_VARIANT
}

export interface RouteParams {
	view: DashboardView
	projectId?: string
	routeType?: string
	routeId?: string
}
