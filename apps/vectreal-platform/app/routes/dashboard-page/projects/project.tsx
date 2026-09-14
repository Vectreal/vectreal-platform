import { data, Outlet, useLocation } from 'react-router'

import { Route } from './+types/project'
import { ContentListing } from '../../../components/dashboard'
import { loadAuthenticatedSession } from '../../../lib/domain/auth/auth-loader.server'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import {
	getRootSceneFolders,
	getRootScenes,
	getSceneFolderChildCounts
} from '../../../lib/domain/scene/server/scene-folder-repository.server'
import { shouldRevalidateForRouteParams } from '../../../lib/navigation/dashboard-route-behavior'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId

	if (!projectId) {
		throw new Response('Project ID is required', { status: 400 })
	}

	const { user, headers } = await loadAuthenticatedSession(request)

	// Fetch project data
	const project = await getProject(projectId, user.id)

	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	// Fetch root folders and root scenes in parallel
	const [folders, scenes] = await Promise.all([
		getRootSceneFolders(projectId, user.id),
		getRootScenes(projectId, user.id)
	])

	const folderChildCounts = await getSceneFolderChildCounts(
		folders.map((folder) => folder.id)
	)

	return data(
		{
			project,
			folders: folders.map((folder) => ({
				...folder,
				childCount: folderChildCounts.get(folder.id) ?? 0
			})),
			scenes
		},
		{ headers }
	)
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentParams,
	nextParams,
	formMethod,
	actionResult,
	defaultShouldRevalidate
}) => {
	return shouldRevalidateForRouteParams({
		currentParams,
		nextParams,
		paramKeys: ['projectId'],
		formMethod,
		actionResult,
		defaultShouldRevalidate
	})
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const ProjectPage = ({ loaderData }: Route.ComponentProps) => {
	const location = useLocation()
	const { project, folders, scenes } = loaderData

	/*
	  The folder and scene routes are children of this one, so this component
	  stays mounted while they render and must yield the page to the outlet. The
	  edit route is the exception: it opens as a drawer over the listing.
	*/
	const projectBasePath = `/dashboard/projects/${project.id}`
	const shouldRenderListing =
		location.pathname === projectBasePath ||
		location.pathname === `${projectBasePath}/edit`

	if (!shouldRenderListing) {
		return <Outlet />
	}

	return (
		<>
			<ContentListing
				folders={folders}
				scenes={scenes}
				projectId={project.id}
				projectName={project.name}
				namespace="project-content"
			/>
			<Outlet />
		</>
	)
}

export default ProjectPage
