import { ApiResponse } from '@shared/utils'
import { LoaderFunctionArgs } from 'react-router'

import { getUserProjects } from '../../lib/domain/project/project-repository.server'
import { getRootSceneFolders } from '../../lib/domain/scene/server/scene-folder-repository.server'
import { getAuthUser } from '../../lib/http/auth.server'

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
			: (projects[0]?.id ?? null)

	const folders = selectedProjectId
		? (await getRootSceneFolders(selectedProjectId, authResult.user.id))
				.map((folder) => ({
					id: folder.id,
					name: folder.name
				}))
				.sort((left, right) => left.name.localeCompare(right.name))
		: []

	return ApiResponse.success({
		projects,
		folders,
		selectedProjectId
	}, 200, { headers: new Headers(authResult.headers) })
}
