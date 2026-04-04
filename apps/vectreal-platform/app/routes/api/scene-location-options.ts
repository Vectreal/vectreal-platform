import { ApiResponse } from '@shared/utils'
import { LoaderFunctionArgs } from 'react-router'

import { getUserProjects } from '../../lib/domain/project/project-repository.server'
import { getSceneFolderTree } from '../../lib/domain/scene/server/scene-folder-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'

import type { SceneLocationFolderOption } from '../../types/api'

export async function loader({ request }: LoaderFunctionArgs) {
	const authResult = await getAuthUser(request)
	if (authResult instanceof Response) {
		return authResult
	}

	const url = new URL(request.url)
	const requestedProjectId = url.searchParams.get('projectId')?.trim() || null

	const userProjects = await getUserProjects(authResult.user.id)
	const projects = userProjects
		.map(({ project }) => ({
			id: project.id,
			name: project.name
		}))
		.sort((left, right) => left.name.localeCompare(right.name))

	const selectedProjectId =
		requestedProjectId &&
		projects.some((project) => project.id === requestedProjectId)
			? requestedProjectId
			: null

	let folders: SceneLocationFolderOption[] = []
	if (selectedProjectId) {
		try {
			folders = await getSceneFolderTree(selectedProjectId, authResult.user.id)
		} catch {
			folders = []
		}
	}

	return ApiResponse.success(
		{
			projects,
			folders,
			selectedProjectId
		},
		200,
		{ headers: new Headers(authResult.headers) }
	)
}
