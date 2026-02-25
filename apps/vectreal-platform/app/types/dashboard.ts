/**
 * Dashboard Layout Types
 * @description Type definitions for the dashboard layout components
 */

import type {
	FolderLoaderData,
	ProjectLoaderData,
	SceneLoaderData
} from '../lib/domain/dashboard/dashboard-types'
import type { ReactNode } from 'react'

export enum ACTION_VARIANT {
	CREATE_PROJECT = 'create-project',
	PROJECT_LIST = 'projects-list',
	PROJECT_DETAIL = 'project-detail',
	FOLDER_DETAIL = 'folder-detail',
	SCENE_DETAIL = 'scene-detail',
	DASHBOARD = 'dashboard',
	ORG_LIST = 'organizations-list'
}

export type DashboardView =
	| 'projects'
	| 'organizations'
	| 'settings'
	| 'dashboard'

/**
 * Route context discriminated union for type-safe routing
 */
export type RouteContext =
	| 'dashboard'
	| 'project-list'
	| 'project-detail'
	| 'folder-detail'
	| 'scene-detail'
	| 'organizations'
	| 'settings'

/**
 * Navigation state passed through React Router
 */
export interface NavigationState {
	name?: string
	description?: string
	projectName?: string
	type?: 'scene' | 'folder' | 'project'
}

export interface TitleContent {
	title: string
	description: string
}

/**
 * Configuration for dashboard content with loading states
 */
export interface DashboardContentConfig {
	title: string
	description: string
	actionVariant?: ACTION_VARIANT
	loadingTitle?: string | ReactNode
	loadingDescription?: string | ReactNode
}

export interface DynamicHeaderContent {
	title: string | ReactNode
	description: string | ReactNode
	actionVariant?: ACTION_VARIANT
	breadcrumbs?: BreadcrumbItem[]
	isLoading?: boolean
}

export interface RouteParams {
	view: DashboardView
	projectId?: string
	routeType?: string
	routeId?: string
}

/**
 * Typed result from route data extraction
 */
export interface RouteDataResult {
	project?: ProjectLoaderData
	folder?: FolderLoaderData
	scene?: SceneLoaderData
}

/**
 * Breadcrumb item for navigation
 */
export interface BreadcrumbItem {
	label: string
	to?: string
	isLast?: boolean
}
