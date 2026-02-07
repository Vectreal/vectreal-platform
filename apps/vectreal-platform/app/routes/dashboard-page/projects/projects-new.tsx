import { Button } from '@shared/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Link, useLoaderData } from 'react-router'

import { loadAuthenticatedUser } from '../../../lib/loaders/auth-loader.server'
import { computeProjectCreationCapabilities } from '../../../lib/loaders/stats-helpers.server'
import type { ProjectNewLoaderData } from '../../../lib/loaders/types'
import { userService } from '../../../lib/services/user-service.server'

import { Route } from './+types/projects-new'

export async function loader({ request }: Route.LoaderArgs) {
	// Authenticate and initialize user
	const { user, userWithDefaults } = await loadAuthenticatedUser(request)

	// Fetch organizations for project creation form
	const organizations = await userService.getUserOrganizations(user.id)

	// Compute project creation capabilities
	const projectCreationCapabilities =
		computeProjectCreationCapabilities(organizations)

	const loaderData: ProjectNewLoaderData = {
		user,
		userWithDefaults,
		organizations,
		projectCreationCapabilities
	}

	return loaderData
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../../components/errors'

const ProjectsNewPage = () => {
	const { organizations, projectCreationCapabilities } =
		useLoaderData<typeof loader>()
	return (
		<div className="p-6">
			<div className="mb-6 flex items-center gap-4">
				<Link viewTransition to="/dashboard/projects/">
					<Button variant="outline" size="sm">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Projects
					</Button>
				</Link>
				<h1 className="text-primary text-3xl font-bold">
					Create a New Project
				</h1>
			</div>
			<div className="rounded-lg border bg-white p-6">
				<p className="text-primary/70">
					Project creation form will be implemented here.
				</p>
			</div>
		</div>
	)
}

export default ProjectsNewPage
