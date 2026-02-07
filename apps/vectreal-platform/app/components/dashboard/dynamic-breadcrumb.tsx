/**
 * Dynamic Breadcrumb Component
 * @description Smart breadcrumb navigation that adapts to current route
 */

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator
} from '@shared/components/ui/breadcrumb'
import React, { memo } from 'react'
import { Link, useLocation, useMatches } from 'react-router'

import type {
	FolderLoaderData,
	ProjectLoaderData,
	SceneLoaderData
} from '../../lib/loaders/types'

import {
	getTitleContent,
	isFolderRoute,
	isSceneRoute,
	isValidDashboardView,
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
 * DynamicBreadcrumb component renders context-aware breadcrumb navigation
 * Consolidates all breadcrumb logic in a single, maintainable component
 * Adapts to different route types: projects list, project detail, folder, scene
 * Memoized to prevent unnecessary re-renders
 */
export const DynamicBreadcrumb = memo(() => {
	const location = useLocation()
	const matches = useMatches()
	const routeParams = parseRouteParams(location.pathname)
	const { view, projectId, routeType, routeId } = routeParams

	// Get data from route loaders
	const {
		project: projectData,
		folder: folderData,
		scene: sceneData
	} = getRouteData(matches)

	// Early return if view is invalid
	if (!view || !isValidDashboardView(view)) {
		return null
	}

	const titleContent = getTitleContent(view)
	const isFolder = isFolderRoute(routeParams)
	const isScene = isSceneRoute(routeParams)

	// Helper function to render a breadcrumb item
	const renderBreadcrumbItem = (to: string, label: string, isLast = false) => (
		<React.Fragment key={to}>
			<BreadcrumbSeparator />
			<BreadcrumbItem>
				{isLast ? (
					<BreadcrumbPage className="text-primary">{label}</BreadcrumbPage>
				) : (
					<BreadcrumbLink asChild>
						<Link viewTransition to={to}>
							{label}
						</Link>
					</BreadcrumbLink>
				)}
			</BreadcrumbItem>
		</React.Fragment>
	)

	// Render dynamic breadcrumbs based on route type
	const renderDynamicBreadcrumbs = () => {
		const items: React.ReactNode[] = []

		// For folder routes: Dashboard > Projects > Project > CurrentFolder
		if (
			isFolder &&
			projectId &&
			routeId &&
			folderData?.folder &&
			folderData?.project
		) {
			const projectName = folderData.project.name || 'Project'
			const folderName = folderData.folder.name || 'Folder'
			items.push(
				renderBreadcrumbItem(`/dashboard/projects/${projectId}`, projectName)
			)
			items.push(renderBreadcrumbItem('', folderName, true))
		}

		// For scene routes: Dashboard > Projects > Project > Scene
		else if (
			isScene &&
			projectId &&
			routeType &&
			sceneData?.scene &&
			sceneData?.project
		) {
			const projectName = sceneData.project.name || 'Project'
			const sceneName = sceneData.scene.name || 'Scene'

			items.push(
				renderBreadcrumbItem(`/dashboard/projects/${projectId}`, projectName)
			)
			items.push(renderBreadcrumbItem('', sceneName, true))
		}

		// For project routes: Dashboard > Projects > Project
		else if (projectId && projectData?.project) {
			const projectName = projectData.project.name || 'Project'
			items.push(renderBreadcrumbItem('', projectName, true))
		}

		return items
	}

	return (
		<Breadcrumb className="grow">
			<BreadcrumbList className="text-primary/75">
				<BreadcrumbItem>
					<BreadcrumbLink asChild>
						<Link viewTransition to="/dashboard">
							Dashboard
						</Link>
					</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbLink asChild>
						<Link viewTransition to={`/dashboard/${view}`}>
							{titleContent.title}
						</Link>
					</BreadcrumbLink>
				</BreadcrumbItem>
				{renderDynamicBreadcrumbs()}
			</BreadcrumbList>
		</Breadcrumb>
	)
})

DynamicBreadcrumb.displayName = 'DynamicBreadcrumb'
