import { data } from 'react-router'

import { Route } from './+types/folder'
import { ContentListing } from '../../../components/dashboard'
import { ContentListingSkeleton } from '../../../components/skeletons'
import { loadAuthenticatedSession } from '../../../lib/domain/auth/auth-loader.server'
import { getProject } from '../../../lib/domain/project/project-repository.server'
import {
	getChildFolders,
	getSceneFolderChildCounts,
	getFolderScenes,
	getSceneFolder,
	getSceneFolderAncestry
} from '../../../lib/domain/scene/server/scene-folder-repository.server'
import { shouldRevalidateForRouteParams } from '../../../lib/navigation/dashboard-route-behavior'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request, params }: Route.LoaderArgs) {
	const projectId = params.projectId
	const folderId = params.folderId

	if (!projectId || !folderId) {
		throw new Response('Project ID and Folder ID are required', { status: 400 })
	}

	const { user, headers } = await loadAuthenticatedSession(request)

	// Fetch project and folder data
	const [project, folder] = await Promise.all([
		getProject(projectId, user.id),
		getSceneFolder(folderId, user.id)
	])

	if (!project) {
		throw new Response('Project not found', { status: 404 })
	}

	if (!folder) {
		throw new Response('Folder not found', { status: 404 })
	}

	// Fetch folder content and ancestry in parallel
	const [subfolders, scenes, folderPath] = await Promise.all([
		getChildFolders(folderId, user.id),
		getFolderScenes(folderId, user.id),
		getSceneFolderAncestry(folderId, user.id)
	])

	const subfolderChildCounts = await getSceneFolderChildCounts(
		subfolders.map((subfolder) => subfolder.id)
	)

	return data(
		{
			project,
			folder,
			folderPath,
			subfolders: subfolders.map((subfolder) => ({
				...subfolder,
				childCount: subfolderChildCounts.get(subfolder.id) ?? 0
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
		paramKeys: ['projectId', 'folderId'],
		formMethod,
		actionResult,
		defaultShouldRevalidate
	})
}

export function HydrateFallback() {
	return <ContentListingSkeleton />
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const FolderPage = ({ loaderData }: Route.ComponentProps) => {
	const { project, subfolders, scenes } = loaderData

	return (
		<ContentListing
			folders={subfolders}
			scenes={scenes}
			projectId={project.id}
			projectName={project.name}
			namespace="folder-content"
		/>
	)
}

export default FolderPage
