import { createContext, Outlet, redirect } from 'react-router'

import { PlatformContext } from '../../contexts/platform-context'
import { type IPlatformContext } from '../../contexts/platform-context'
import { FolderType, SceneType } from '../../hooks'
import { PlatformApiService } from '../../lib/services/platform-api-service.server'
import { projectService } from '../../lib/services/project-service.server'
import { sceneFolderService } from '../../lib/services/scene-folder-service.server'
import { userService } from '../../lib/services/user-service.server'

import { Route } from './+types/platform-data-layout'

const defaults = {
	user: null,
	userWithDefaults: null,
	organizations: [],
	projects: [],
	scenes: [],
	sceneFolders: [],
	error: 'Failed to initialize user data'
}

const middlewarePlatformContext = createContext<IPlatformContext>(defaults)

const authMiddleware: Route.MiddlewareFunction = async ({
	request,
	context
}) => {
	const authResponse = await PlatformApiService.getAuthUser(request)

	// In case of unauthorized, redirect to sign-up
	// A response can only be an instance of Response if it's an error
	if (authResponse instanceof Response) {
		return redirect('/sign-up', { headers: authResponse.headers })
	}

	const { user } = authResponse

	try {
		// Initialize user defaults (creates user in local DB, default org, and project)
		const userWithDefaults = await userService.initializeUserDefaults(user)

		// Get all organizations the user is a member of
		const organizations = await userService.getUserOrganizations(user.id)

		// Get all projects the user has access to
		const userProjects = await projectService.getUserProjects(user.id)

		// Get all scenes and scene folders for the user's projects
		const allScenes: Array<SceneType> = []
		const allSceneFolders: Array<FolderType> = []

		// Fetch scenes and folders for each project the user has access to
		for (const { project } of userProjects) {
			try {
				const [projectScenes, projectFolders] = await Promise.all([
					sceneFolderService.getProjectScenes(project.id, user.id),
					sceneFolderService.getProjectSceneFolders(project.id, user.id)
				])

				// Add scenes with project context
				projectScenes.forEach((scene) => {
					allScenes.push(scene)
				})

				// Add folders with project context
				projectFolders.forEach((folder) => {
					allSceneFolders.push(folder)
				})
			} catch (error) {
				console.error(
					`Failed to fetch scenes/folders for project ${project.id}:`,
					error
				)
				// Continue with other projects if one fails
			}
		}

		context.set(middlewarePlatformContext, {
			user,
			userWithDefaults,
			organizations,
			projects: userProjects,
			scenes: allScenes,
			sceneFolders: allSceneFolders
		})
	} catch (error) {
		console.error('Failed to initialize user:', error)
		// If user initialization fails, still allow access but log the error
		context.set(middlewarePlatformContext, { ...defaults, user })
	}
}

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export const loader = async ({ request, context }: Route.ActionArgs) => {
	return context.get(middlewarePlatformContext)
}

const PlatformDataLayout = ({ loaderData }: Route.ComponentProps) => {
	// Provide auth context to all child routes
	return (
		<PlatformContext.Provider value={loaderData || defaults}>
			<Outlet />
		</PlatformContext.Provider>
	)
}

export default PlatformDataLayout
