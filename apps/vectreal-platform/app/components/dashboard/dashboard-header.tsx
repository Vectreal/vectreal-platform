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
import { useLocation } from 'react-router'

import {
	useFolderContent,
	useProject,
	useProjectContent,
	useScene,
	useSceneFolder
} from '../../hooks'

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
 * Hook that generates dynamic header content based on the current route
 * Returns title, description, and action variant for rendering
 */
export const useDynamicHeader = (): DynamicHeaderContent => {
	const location = useLocation()
	const routeParams = parseRouteParams(location.pathname)
	const { view, projectId, routeType, routeId } = routeParams

	// Hooks for data fetching
	const project = useProject(projectId || '')
	const projectContent = useProjectContent(projectId || '')
	const folderContent = useFolderContent(routeId || '')
	const folder = useSceneFolder(routeId || '')
	const scene = useScene(routeType || '')

	// Route type checks
	const isFolder = isFolderRoute(routeParams)
	const isScene = isSceneRoute(routeParams)

	const dynamicContent = useMemo(() => {
		// Scene route - show scene name and stats
		if (isScene && scene && project) {
			return {
				title: scene.name,
				description: scene.description || `Scene in ${project.project.name}`,
				actionVariant: 'scene-detail' as ACTION_VARIANT
			}
		}

		// Folder route - show folder name and stats
		if (isFolder && folder && folderContent && project) {
			const totalItems =
				folderContent.subfolders.length + folderContent.scenes.length
			return {
				title: folder.name,
				description:
					folder.description ||
					`${totalItems} items in ${project.project.name}`,
				actionVariant: ACTION_VARIANT.FOLDER_DETAIL
			}
		}

		// Project route - show project name and stats
		if (view === 'projects' && projectId && project && projectContent) {
			const totalItems =
				projectContent.folders.length + projectContent.scenes.length
			const folderCount = projectContent.folders.length
			const sceneCount = projectContent.scenes.length

			return {
				title: project.project.name,
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
		scene,
		folder,
		project,
		projectContent,
		folderContent
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
