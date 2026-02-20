/**
 * Dashboard Content Hook
 * @description Composable hook for generating dashboard header content and breadcrumbs
 * Replaces complex nested logic with clean switch-based routing
 */

import { useMemo } from 'react'
import { useLocation, useMatches, useNavigation } from 'react-router'

import {
	extractRouteData,
	getRouteContext,
	parseRouteParams
} from '../components/dashboard/utils'
import { DASHBOARD_CONTENT, DASHBOARD_ROUTES } from '../constants/dashboard'
import type {
	BreadcrumbItem,
	DynamicHeaderContent,
	NavigationState
} from '../types/dashboard'

/**
 * Main dashboard content hook that provides header and breadcrumb data
 * Uses composable pattern with single-level switch statements for clarity
 * Handles both optimistic (loading) and loaded states
 * @returns Dashboard header content with title, description, action variant, and breadcrumbs
 */
export const useDashboardHeaderData = (): DynamicHeaderContent => {
	const location = useLocation()
	const navigation = useNavigation()
	const matches = useMatches()

	// Parse current route
	const routeParams = parseRouteParams(location.pathname)
	const routeContext = getRouteContext(location.pathname, routeParams)

	// Extract typed data from route loaders
	const { project, folder, scene } = extractRouteData(matches)

	const content = useMemo(() => {
		// Skip optimistic updates for drawer routes to prevent flickering
		const isDrawerRoute = (pathname: string) =>
			pathname === '/dashboard/projects/new'

		// Handle optimistic updates during navigation (skip for drawer routes)
		if (
			navigation.state === 'loading' &&
			navigation.location &&
			!isDrawerRoute(location.pathname) &&
			!isDrawerRoute(navigation.location.pathname)
		) {
			const nextRouteContext = getRouteContext(
				navigation.location.pathname,
				parseRouteParams(navigation.location.pathname)
			)
			const nextConfig = DASHBOARD_CONTENT[nextRouteContext]
			const navState = navigation.location.state as NavigationState | null

			// Use navigation state for instant updates (passed from DashboardCards)
			if (navState?.name) {
				const fallbackDescription =
					nextConfig.loadingDescription || nextConfig.description
				const itemDescription =
					navState.description ||
					(navState.projectName
						? `${navState.type === 'scene' ? 'Scene' : 'Folder'} in ${navState.projectName}`
						: fallbackDescription)

				// Determine action variant from navigation state
				let actionVariant = nextConfig.actionVariant
				switch (navState.type) {
					case 'scene':
						actionVariant = DASHBOARD_CONTENT['scene-detail'].actionVariant
						break
					case 'folder':
						actionVariant = DASHBOARD_CONTENT['folder-detail'].actionVariant
						break
					case 'project':
						actionVariant = DASHBOARD_CONTENT['project-detail'].actionVariant
						break
				}

				return {
					title: navState.name,
					description: itemDescription,
					actionVariant,
					isLoading: true
				}
			}

			// Use optimistic route context for static routes
			return {
				title: nextConfig.loadingTitle || nextConfig.title,
				description: nextConfig.loadingDescription || nextConfig.description,
				actionVariant: nextConfig.actionVariant,
				isLoading: true
			}
		}

		// Generate content based on loaded route context
		switch (routeContext) {
			case 'scene-detail':
				if (scene?.scene && scene?.project) {
					const breadcrumbs: BreadcrumbItem[] = [
						{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
						{ label: 'Projects', to: DASHBOARD_ROUTES.PROJECTS },
						{
							label: scene.project.name || 'Project',
							to: DASHBOARD_ROUTES.PROJECT_DETAIL(scene.project.id)
						},
						{ label: scene.scene.name || 'Scene', isLast: true }
					]

					return {
						title: scene.scene.name,
						description:
							scene.scene.description || `Scene in ${scene.project.name}`,
						actionVariant: DASHBOARD_CONTENT['scene-detail'].actionVariant,
						breadcrumbs
					}
				}
				break

			case 'folder-detail':
				if (folder?.folder && folder?.project) {
					const totalItems =
						(folder.subfolders?.length || 0) + (folder.scenes?.length || 0)

					const breadcrumbs: BreadcrumbItem[] = [
						{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
						{ label: 'Projects', to: DASHBOARD_ROUTES.PROJECTS },
						{
							label: folder.project.name || 'Project',
							to: DASHBOARD_ROUTES.PROJECT_DETAIL(folder.project.id)
						},
						{ label: folder.folder.name || 'Folder', isLast: true }
					]

					return {
						title: folder.folder.name,
						description:
							folder.folder.description ||
							`${totalItems} items in ${folder.project.name}`,
						actionVariant: DASHBOARD_CONTENT['folder-detail'].actionVariant,
						breadcrumbs
					}
				}
				break

			case 'project-detail':
				if (project?.project) {
					const totalItems =
						(project.folders?.length || 0) + (project.scenes?.length || 0)
					const folderCount = project.folders?.length || 0
					const sceneCount = project.scenes?.length || 0

					const breadcrumbs: BreadcrumbItem[] = [
						{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
						{ label: 'Projects', to: DASHBOARD_ROUTES.PROJECTS },
						{ label: project.project.name || 'Project', isLast: true }
					]

					return {
						title: project.project.name,
						description: `${totalItems} items • ${folderCount} folders • ${sceneCount} scenes`,
						actionVariant: DASHBOARD_CONTENT['project-detail'].actionVariant,
						breadcrumbs
					}
				}
				break

			case 'project-list': {
				const config = DASHBOARD_CONTENT['project-list']
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'organizations': {
				const config = DASHBOARD_CONTENT.organizations
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'settings': {
				const config = DASHBOARD_CONTENT.settings
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: 'Dashboard', to: DASHBOARD_ROUTES.DASHBOARD },
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}

			case 'dashboard':
			default: {
				const config = DASHBOARD_CONTENT.dashboard
				const breadcrumbs: BreadcrumbItem[] = [
					{ label: config.title, isLast: true }
				]

				return {
					title: config.title,
					description: config.description,
					actionVariant: config.actionVariant,
					breadcrumbs
				}
			}
		}

		// Fallback to dashboard config
		const config = DASHBOARD_CONTENT.dashboard
		return {
			title: config.title,
			description: config.description,
			actionVariant: config.actionVariant
		}
	}, [
		location.pathname,
		routeContext,
		project,
		folder,
		scene,
		navigation.state,
		navigation.location
	])

	return content
}
