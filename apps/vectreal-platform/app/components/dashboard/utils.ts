/**
 * Dashboard Layout Utilities
 * @description Utility functions for parsing and validating dashboard routes
 */

import { TITLE_CONTENT } from '../../constants/dashboard'
import { UUID_REGEX } from '../../constants/utility-constants'

import type {
	DashboardView,
	RouteParams,
	TitleContent
} from '../../types/dashboard'

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
	return view in TITLE_CONTENT
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
 * @param view - Dashboard view
 * @returns Title content or default values
 */
export const getTitleContent = (view: DashboardView): TitleContent => {
	return TITLE_CONTENT[view] || { title: '', description: '' }
}
