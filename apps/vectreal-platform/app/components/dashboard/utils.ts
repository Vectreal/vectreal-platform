/**
 * Dashboard Layout Utilities
 * @description Utility functions for parsing and validating dashboard routes
 */


import { DASHBOARD_CONTENT } from '../../constants/dashboard'
import { UUID_REGEX } from '../../constants/utility-constants'

import type {
	DashboardView,
	RouteContext,
	RouteDataResult,
	RouteParams,
	TitleContent
} from '../../types/dashboard'
import type { UIMatch } from 'react-router'

/**
 * Parses the current location pathname into structured route parameters
 * @param pathname - The current location pathname
 * @returns Parsed route parameters
 */
export const parseRouteParams = (pathname: string): RouteParams => {
	const slugs = pathname.split('/')
	const view = slugs[2] as DashboardView
	const projectId = slugs[3]
	const routeType = slugs[4]
	const routeId = slugs[5]

	return {
		view,
		projectId: projectId || undefined,
		routeType: routeType || undefined,
		routeId: routeId || undefined
	}
}

/**
 * Validates if a view is a valid dashboard view
 * @param view - The view to validate
 * @returns True if the view is valid
 */
export const isValidDashboardView = (view: string): view is DashboardView => {
	const validViews: DashboardView[] = [
		'dashboard',
		'projects',
		'organizations',
		'settings'
	]
	return validViews.includes(view as DashboardView)
}

/**
 * Checks if the current route is a folder route
 * @param params - Route parameters
 * @returns True if it's a folder route
 */
export const isFolderRoute = (params: RouteParams): boolean => {
	const { view, routeType, routeId } = params
	return view === 'projects' && routeType === 'folder' && Boolean(routeId)
}

/**
 * Checks if the current route is a scene route
 * @param params - Route parameters
 * @returns True if it's a scene route
 */
export const isSceneRoute = (params: RouteParams): boolean => {
	const { view, projectId, routeType, routeId } = params
	return (
		view === 'projects' &&
		Boolean(projectId) &&
		Boolean(routeType) &&
		UUID_REGEX.test(routeType || '') &&
		!routeId
	)
}

/**
 * Gets the title content for a specific view
 * Maps DashboardView to RouteContext and retrieves from DASHBOARD_CONTENT
 * @param view - Dashboard view
 * @returns Title content or default values
 */
export const getTitleContent = (view: DashboardView): TitleContent | null => {
	const routeContextMap: Record<
		DashboardView,
		Exclude<RouteContext, 'scene-detail'>
	> = {
		dashboard: 'dashboard',
		projects: 'project-list',
		organizations: 'organizations',
		settings: 'settings'
	}

	const routeContext = routeContextMap[view]
	const config = DASHBOARD_CONTENT[routeContext]

	return {
		title: config?.title || '',
		description: config?.description || ''
	}
}

/**
 * Extracts typed route data from React Router matches
 * Consolidates loader data extraction logic used across dashboard components
 * @param matches - Route matches from useMatches()
 * @returns Typed route data with project, folder, and scene information
 */
export const extractRouteData = (
	matches: UIMatch<unknown, unknown>[]
): RouteDataResult => {
	const routeData: RouteDataResult = {}

	for (const match of matches) {
		const loaderData = match.loaderData
		if (!loaderData || typeof loaderData !== 'object') continue

		// Check for project data (has 'project' and 'folders' keys)
		if ('project' in loaderData && 'folders' in loaderData) {
			routeData.project = loaderData as RouteDataResult['project']
		}
		// Check for folder data
		if ('folder' in loaderData) {
			routeData.folder = loaderData as RouteDataResult['folder']
		}
		// Check for scene data
		if ('scene' in loaderData) {
			routeData.scene = loaderData as RouteDataResult['scene']
		}
	}

	return routeData
}

/**
 * Determines the route context from pathname and route parameters
 * Provides discriminated union for type-safe route handling
 * @param pathname - Current location pathname
 * @param params - Parsed route parameters
 * @returns Route context discriminated union
 */
export const getRouteContext = (
	pathname: string,
	params: RouteParams
): RouteContext => {
	const { view, projectId, routeType, routeId } = params

	// Scene route: /dashboard/projects/:projectId/:sceneId
	if (
		view === 'projects' &&
		projectId &&
		routeType &&
		UUID_REGEX.test(routeType) &&
		!routeId
	) {
		return 'scene-detail'
	}

	// Folder route: /dashboard/projects/:projectId/folder/:folderId
	if (view === 'projects' && routeType === 'folder' && routeId) {
		return 'folder-detail'
	}

	// Project new route (drawer overlay) - keep projects list header
	if (pathname === '/dashboard/projects/new') {
		return 'project-list'
	}

	// Project detail route: /dashboard/projects/:projectId
	if (view === 'projects' && projectId) {
		return 'project-detail'
	}

	// Projects list route: /dashboard/projects
	if (view === 'projects') {
		return 'project-list'
	}

	// Organizations route
	if (view === 'organizations') {
		return 'organizations'
	}

	// Settings route
	if (view === 'settings') {
		return 'settings'
	}

	// Dashboard home
	return 'dashboard'
}
