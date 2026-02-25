import { Skeleton } from '@shared/components/ui/skeleton'

import {
	ACTION_VARIANT,
	type DashboardContentConfig,
	type RouteContext
} from '../types/dashboard'

/**
 * Route path constants - single source of truth for dashboard routes
 */
export const DASHBOARD_ROUTES = {
	DASHBOARD: '/dashboard',
	PROJECTS: '/dashboard/projects',
	ORGANIZATIONS: '/dashboard/organizations',
	SETTINGS: '/dashboard/settings',
	PROJECT_DETAIL: (projectId: string) => `/dashboard/projects/${projectId}`,
	FOLDER_DETAIL: (projectId: string, folderId: string) =>
		`/dashboard/projects/${projectId}/folder/${folderId}`,
	SCENE_DETAIL: (projectId: string, sceneId: string) =>
		`/dashboard/projects/${projectId}/${sceneId}`
} as const

/**
 * Unified dashboard content configuration by route context
 * Includes both loaded and optimistic (loading) state content
 */
export const DASHBOARD_CONTENT: Record<RouteContext, DashboardContentConfig> = {
	dashboard: {
		title: 'Recent Activity',
		description: 'Welcome to your dashboard',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: ACTION_VARIANT.DASHBOARD
	},
	'project-list': {
		title: 'Projects',
		description: 'Manage your projects and workspace environments',
		loadingTitle: <Skeleton className="h-6 w-1/3" />,
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: ACTION_VARIANT.PROJECT_LIST
	},
	'project-detail': {
		title: 'Project',
		description: 'Project details',
		actionVariant: ACTION_VARIANT.PROJECT_DETAIL
	},
	'folder-detail': {
		title: 'Folder',
		description: 'Folder contents',
		actionVariant: ACTION_VARIANT.FOLDER_DETAIL
	},
	'scene-detail': {
		title: 'Scene',
		description: 'Scene details',
		actionVariant: ACTION_VARIANT.SCENE_DETAIL
	},
	organizations: {
		title: 'Organizations',
		description: 'Manage your organizations and teams',
		loadingTitle: 'Organizations',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: ACTION_VARIANT.ORG_LIST
	},
	settings: {
		title: 'Settings',
		description: 'Manage your account settings and preferences',
		loadingTitle: 'Settings',
		loadingDescription: <Skeleton className="h-4 w-1/3" />,
		actionVariant: undefined
	}
} as const
