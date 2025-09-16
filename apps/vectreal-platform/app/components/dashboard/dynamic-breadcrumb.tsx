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
} from '@vctrl-ui/ui/breadcrumb'
import React, { memo } from 'react'
import { Link, useLocation } from 'react-router'

import { useFolderBreadcrumbs, useProject, useScene } from '../../hooks'

import {
	getTitleContent,
	isFolderRoute,
	isSceneRoute,
	isValidDashboardView,
	parseRouteParams
} from './utils'

/**
 * DynamicBreadcrumb component renders context-aware breadcrumb navigation
 * Consolidates all breadcrumb logic in a single, maintainable component
 * Adapts to different route types: projects list, project detail, folder, scene
 * Memoized to prevent unnecessary re-renders
 */
export const DynamicBreadcrumb = memo(() => {
	const location = useLocation()
	const routeParams = parseRouteParams(location.pathname)
	const { view, projectId, routeType, routeId } = routeParams

	// Data hooks - only fetch what we need based on route
	const project = useProject(projectId || '')
	const scene = useScene(routeType || '')
	const folderBreadcrumbs = useFolderBreadcrumbs(
		routeId || scene?.scene.folderId || ''
	)

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
					<BreadcrumbPage>{label}</BreadcrumbPage>
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

		// For folder routes: Dashboard > Projects > Project > Folder1 > Folder2 > ... > CurrentFolder
		if (isFolder && projectId && routeId && project) {
			const projectName = project.project.name || 'Project'
			items.push(
				renderBreadcrumbItem(`/dashboard/projects/${projectId}`, projectName)
			)

			folderBreadcrumbs.forEach((breadcrumb, index) => {
				const isLast = index === folderBreadcrumbs.length - 1
				items.push(
					renderBreadcrumbItem(
						`/dashboard/projects/${projectId}/folder/${breadcrumb.id}`,
						breadcrumb.name,
						isLast
					)
				)
			})
		}

		// For scene routes: Dashboard > Projects > Project > [Folders...] > Scene
		else if (isScene && projectId && routeType && scene && project) {
			const projectName = project.project.name || 'Project'
			const sceneName = scene.scene.name || 'Scene'

			items.push(
				renderBreadcrumbItem(`/dashboard/projects/${projectId}`, projectName)
			)

			// Add folder hierarchy if scene is in folders
			if (scene.scene.folderId && folderBreadcrumbs.length > 0) {
				folderBreadcrumbs.forEach((breadcrumb) => {
					items.push(
						renderBreadcrumbItem(
							`/dashboard/projects/${projectId}/folder/${breadcrumb.id}`,
							breadcrumb.name
						)
					)
				})
			}

			items.push(
				renderBreadcrumbItem('', sceneName, true) // Scene is always the last item
			)
		}

		// For project routes: Dashboard > Projects > Project
		else if (projectId && project) {
			const projectName = project.project.name || 'Project'
			items.push(
				renderBreadcrumbItem('', projectName, true) // Project is the last item
			)
		}

		return items
	}

	return (
		<Breadcrumb className="grow">
			<BreadcrumbList>
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

DynamicBreadcrumb.displayName = 'DynamicBreadcrumb'
