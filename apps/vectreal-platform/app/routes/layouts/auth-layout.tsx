import { Outlet, redirect, useLoaderData } from 'react-router'

import { AuthContext } from '../../contexts/auth-context'
import { projectService } from '../../lib/services/project.service'
import { userService } from '../../lib/services/user.service'
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

		console.log('Auth Layout Data:', {
			userExists: !!user,
			userWithDefaults,
			organizationsCount: organizations.length,
			projectsCount: userProjects.length,
			organizations,
			projects: userProjects
		})

		return {
			user,
			userWithDefaults,
			organizations,
			projects: userProjects
		}
	} catch (error) {
		console.error('Failed to initialize user:', error)
		// If user initialization fails, still allow access but log the error
		return {
			user,
			userWithDefaults: null,
			organizations: [],
			projects: [],
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
