/**
 * Dashboard Header Component
 * @description Main header component with title, description and actions
 */

import { memo } from 'react'

/**
 * Dynamic Header Hook
 * @description Hook for generating dynamic header content based on current route
 */

import { useMemo } from 'react'
import { useLocation, useMatches, useNavigation } from 'react-router'

import type {
	FolderLoaderData,
	ProjectLoaderData,
	SceneLoaderData
} from '../../lib/loaders/types'
import { ACTION_VARIANT } from '../../types/dashboard'
import type { DynamicHeaderContent } from '../../types/dashboard'

import { DashboardActions } from './dashboard-actions'
import {
	getTitleContent,
	isFolderRoute,
	isSceneRoute,
	parseRouteParams
} from './utils'

/**
 * Extract data from route matches
 */
function getRouteData(matches: ReturnType<typeof useMatches>) {
	const routeData: {
		project?: ProjectLoaderData
		folder?: FolderLoaderData
		scene?: SceneLoaderData
	} = {}

	for (const match of matches) {
		const data = match.loaderData as
			| ProjectLoaderData
			| FolderLoaderData
			| SceneLoaderData
			| Record<string, unknown>
			| undefined
		if (data && 'project' in data && 'folders' in data) {
			routeData.project = data as ProjectLoaderData
		}
		if (data && 'folder' in data) {
			routeData.folder = data as FolderLoaderData
		}
		if (data && 'scene' in data) {
			routeData.scene = data as SceneLoaderData
		}
	}

	return routeData
}

/**
 * Get optimistic title from URL pattern for static routes
 * Returns null for dynamic routes that need data (scenes, folders, project details)
 */
function getOptimisticTitle(
	pathname: string
): { title: string; description: string } | null {
	if (pathname === '/dashboard') {
		return {
			title: 'Recent Access',
			description: 'Your recently accessed projects and scenes'
		}
	}
	if (pathname === '/dashboard/projects') {
		return {
			title: 'Projects',
			description: 'All your projects in one place'
		}
	}
	if (pathname === '/dashboard/organizations') {
		return {
			title: 'Organizations',
			description: 'Manage your organizations'
		}
	}
	if (pathname === '/dashboard/settings') {
		return {
			title: 'Settings',
			description: 'Manage your account settings'
		}
	}

	// For dynamic routes (project detail, scene detail, folder detail),
	// we can't provide optimistic title without data
	return null
}

/**
 * Hook that generates dynamic header content based on the current route
 * Returns title, description, and action variant for rendering
 * Provides optimistic updates during navigation for static routes
 */
export const useDynamicHeader = (): DynamicHeaderContent => {
	const location = useLocation()
	const navigation = useNavigation()
	const matches = useMatches()
	const routeParams = parseRouteParams(location.pathname)
	const { view, projectId } = routeParams

	// Get data from route loaders
	const {
		project: projectData,
		folder: folderData,
		scene: sceneData
	} = getRouteData(matches)

	// Route type checks
	const isFolder = isFolderRoute(routeParams)
	const isScene = isSceneRoute(routeParams)

	const dynamicContent = useMemo(() => {
		// During navigation, try to provide optimistic updates
		if (navigation.state === 'loading' && navigation.location) {
			// Check for navigation state data (passed from DashboardCard)
			const navState = navigation.location.state as {
				name?: string
				description?: string
				projectName?: string
				type?: 'scene' | 'folder' | 'project'
			} | null

			// If navigation state contains item data, use it for instant header update
			if (navState?.name) {
				const itemDescription =
					navState.description ||
					(navState.projectName
						? `${navState.type === 'scene' ? 'Scene' : 'Folder'} in ${navState.projectName}`
						: '')

				const actionVariant =
					navState.type === 'scene'
						? ACTION_VARIANT.SCENE_DETAIL
						: navState.type === 'folder'
							? ACTION_VARIANT.FOLDER_DETAIL
							: navState.type === 'project'
								? ACTION_VARIANT.PROJECT_DETAIL
								: undefined

				return {
					title: navState.name,
					description: itemDescription,
					actionVariant
				}
			}

			// For static routes, use URL-based optimistic title
			const optimisticTitle = getOptimisticTitle(navigation.location.pathname)
			if (optimisticTitle) {
				const actionVariant =
					navigation.location.pathname === '/dashboard'
						? ACTION_VARIANT.DASHBOARD
						: navigation.location.pathname === '/dashboard/projects'
							? ACTION_VARIANT.PROJECT_LIST
							: navigation.location.pathname === '/dashboard/organizations'
								? ACTION_VARIANT.ORG_LIST
								: undefined

				return {
					title: optimisticTitle.title,
					description: optimisticTitle.description,
					actionVariant
				}
			}
		}

		// Scene route - show scene name and stats
		if (isScene && sceneData?.scene && sceneData?.project) {
			return {
				title: sceneData.scene.name,
				description:
					sceneData.scene.description || `Scene in ${sceneData.project.name}`,
				actionVariant: 'scene-detail' as ACTION_VARIANT
			}
		}

		// Folder route - show folder name and stats
		if (isFolder && folderData?.folder && folderData?.project) {
			const totalItems =
				(folderData.subfolders?.length || 0) + (folderData.scenes?.length || 0)
			return {
				title: folderData.folder.name,
				description:
					folderData.folder.description ||
					`${totalItems} items in ${folderData.project.name}`,
				actionVariant: ACTION_VARIANT.FOLDER_DETAIL
			}
		}

		// Project route - show project name and stats
		if (view === 'projects' && projectId && projectData?.project) {
			const totalItems =
				(projectData.folders?.length || 0) + (projectData.scenes?.length || 0)
			const folderCount = projectData.folders?.length || 0
			const sceneCount = projectData.scenes?.length || 0

			return {
				title: projectData.project.name,
				description: `${totalItems} items • ${folderCount} folders • ${sceneCount} scenes`,
				actionVariant: ACTION_VARIANT.PROJECT_DETAIL
			}
		}

		// Base routes - use static titles
		if (view === 'projects') {
			const titleContent = getTitleContent(view)
			return {
				title: titleContent.title,
				description: titleContent.description,
				actionVariant: ACTION_VARIANT.PROJECT_LIST
			}
		} else if (view === 'organizations') {
			const titleContent = getTitleContent(view)
			return {
				title: titleContent.title,
				description: titleContent.description,
				actionVariant: ACTION_VARIANT.ORG_LIST
			}
		} else if (view === 'settings') {
			const titleContent = getTitleContent(view)
			return {
				title: titleContent.title,
				description: titleContent.description,
				actionVariant: undefined
			}
		}

		// Dashboard page
		if (!view) {
			const titleContent = getTitleContent('dashboard')
			return {
				title: titleContent.title,
				description: titleContent.description,
				actionVariant: ACTION_VARIANT.DASHBOARD
			}
		}

		return {
			title: '',
			description: '',
			actionVariant: undefined
		}
	}, [
		view,
		projectId,
		isScene,
		isFolder,
		sceneData,
		folderData,
		projectData,
		navigation.state,
		navigation.location
	])

	return dynamicContent
}

/**
 * DashboardHeader component renders the main page header
 * with dynamic title, description, and contextual actions
 * Memoized to prevent unnecessary re-renders
 */
export const DashboardHeader = memo(() => {
	const { title, description, actionVariant } = useDynamicHeader()

	return (
		<div className="space-y-8 p-6">
			<div className="flex grow flex-col items-start justify-between gap-4 md:flex-row">
				<div className="space-y-1">
					<h1 className="text-5xl font-normal">{title}</h1>
					<p className="text-primary/50">{description}</p>
				</div>

				{actionVariant && <DashboardActions variant={actionVariant} />}
			</div>
		</div>
	)
})

DashboardHeader.displayName = 'DashboardHeader'
