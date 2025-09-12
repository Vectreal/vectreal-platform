import { Outlet, redirect, useLoaderData } from 'react-router'

import { AuthContext } from '../../contexts/auth-context'
import { type sceneFolders, type scenes } from '../../db/schema'
import { projectService } from '../../lib/services/project-service.server'
import { sceneService } from '../../lib/services/scene-service.server'
import { userService } from '../../lib/services/user-service.server'
import { createClient } from '../../lib/supabase.server'

import { Route } from './+types/auth-layout'

export const loader = async ({ request }: Route.ActionArgs) => {
	const { client, headers } = await createClient(request)

	const {
		error,
		data: { user }
	} = await client.auth.getUser()

	if (error || !user) {
		return redirect('/sign-up', { headers })
	}

	try {
		// Initialize user defaults (creates user in local DB, default org, and project)
		const userWithDefaults = await userService.initializeUserDefaults(user)

		// Get all organizations the user is a member of
		const organizations = await userService.getUserOrganizations(user.id)

		// Get all projects the user has access to
		const userProjects = await projectService.getUserProjects(user.id)

		// Get all scenes and scene folders for the user's projects
		const allScenes: Array<{
			scene: typeof scenes.$inferSelect
			projectId: string
		}> = []
		const allSceneFolders: Array<{
			folder: typeof sceneFolders.$inferSelect
			projectId: string
		}> = []

		// Fetch scenes and folders for each project the user has access to
		for (const { project } of userProjects) {
			try {
				const [projectScenes, projectFolders] = await Promise.all([
					sceneService.getProjectScenes(project.id, user.id),
					sceneService.getProjectSceneFolders(project.id, user.id)
				])

				// Add scenes with project context
				projectScenes.forEach((scene) => {
					allScenes.push({ scene, projectId: project.id })
				})

				// Add folders with project context
				projectFolders.forEach((folder) => {
					allSceneFolders.push({ folder, projectId: project.id })
				})
			} catch (error) {
				console.error(
					`Failed to fetch scenes/folders for project ${project.id}:`,
					error
				)
				// Continue with other projects if one fails
			}
		}

		return {
			user,
			userWithDefaults,
			organizations,
			projects: userProjects,
			scenes: allScenes,
			sceneFolders: allSceneFolders
		}
	} catch (error) {
		console.error('Failed to initialize user:', error)
		// If user initialization fails, still allow access but log the error
		return {
			user,
			userWithDefaults: null,
			organizations: [],
			projects: [],
			scenes: [],
			sceneFolders: [],
			error: 'Failed to initialize user data'
		}
	}
}

const AuthLayout = () => {
	const loaderData = useLoaderData<typeof loader>()

	// Provide auth context to all child routes
	return (
		<AuthContext.Provider value={loaderData}>
			<Outlet />
		</AuthContext.Provider>
	)
}

export default AuthLayout
