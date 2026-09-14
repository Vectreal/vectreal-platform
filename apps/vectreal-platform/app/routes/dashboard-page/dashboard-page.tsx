import { useSetAtom } from 'jotai/react'
import { data, Link } from 'react-router'

import { Route } from './+types/dashboard-page'
import { DashboardOverview, SceneCard } from '../../components/dashboard'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import { toSceneRef } from '../../lib/domain/dashboard/dashboard-confirmation'
import { getRecentScenes } from '../../lib/domain/dashboard/dashboard-stats.server'
import { getUserProjects } from '../../lib/domain/project/project-repository.server'
import { getProjectsScenes } from '../../lib/domain/scene/server/scene-folder-repository.server'
import {
	deleteDialogAtom,
	moveDialogAtom
} from '../../lib/stores/dashboard-management-store'

import type { ShouldRevalidateFunction } from 'react-router'

export async function loader({ request }: Route.LoaderArgs) {
	const { user, headers } = await loadAuthenticatedUser(request)

	const userProjects = await getUserProjects(user.id)
	const projectIds = userProjects.map(({ project }) => project.id)
	const scenesByProject = await getProjectsScenes(projectIds, user.id)
	const scenes = Array.from(scenesByProject.values()).flat()

	const projectNamesById = new Map(
		userProjects.map(({ project }) => [project.id, project.name])
	)

	/*
	  The project name is resolved here rather than shipped as the whole project
	  list for the page to look through. The page renders a name per card; it was
	  being sent every project the viewer can reach, in full, to find them.
	*/
	const recentScenes = getRecentScenes(scenes, 10).map((scene) => ({
		id: scene.id,
		name: scene.name,
		projectId: scene.projectId,
		projectName: projectNamesById.get(scene.projectId) ?? 'Unknown',
		folderId: scene.folderId,
		status: scene.status,
		thumbnailUrl: scene.thumbnailUrl,
		updatedAt: scene.updatedAt
	}))

	/*
	  The resumed scene is the most recent one, so shipping the list plus a
	  pointer into it meant the page received the same scene twice and subtracted
	  it back out on the client. The split is a fact about the data, not a layout
	  choice: one scene to pick up, and the rest.

	  `usage` and `plan` were loaded here until the usage route took the band
	  away, and stayed behind because a field that is returned and never read
	  breaks nothing. That cost every visit to this page five counting queries
	  and a subscription read for figures it no longer renders.
	*/
	const [resumeScene = null, ...alsoRecent] = recentScenes

	return data({ resumeScene, alsoRecent }, { headers })
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	actionResult,
	defaultShouldRevalidate
}) => {
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	if (actionResult) {
		return true
	}

	if (currentUrl.pathname === nextUrl.pathname) {
		return false
	}

	return defaultShouldRevalidate
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

const DashboardPage = ({ loaderData }: Route.ComponentProps) => {
	const { alsoRecent, resumeScene } = loaderData
	const setDeleteDialog = useSetAtom(deleteDialogAtom)
	const setMoveDialog = useSetAtom(moveDialogAtom)

	return (
		<div className="space-y-8 py-6">
			<DashboardOverview resumeScene={resumeScene} />

			{alsoRecent.length > 0 ? (
				<section className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-h4">Recent work</h2>
						<Link
							to="/dashboard/projects"
							className="text-muted-foreground hover:text-foreground text-xs"
						>
							All projects
						</Link>
					</div>

					{/*
					  Cards, not the seven-column table this used to be.

					  The question this page is asked is "which one was I working on",
					  and it is answered by recognising a picture. A table answered a
					  different question - compare these on seven axes - with select
					  checkboxes and a bulk-delete bar, on the surface that exists to get
					  someone back into work. It did render the thumbnail, at 36px in the
					  name cell, which is an icon rather than the thing itself.

					  Move stays on the card menu rather than becoming a bulk action:
					  this list spans every project and a move is intra-project, so a
					  multi-project selection has no single valid destination.
					*/}
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
						{alsoRecent.map((scene) => (
							<SceneCard
								key={scene.id}
								scene={scene}
								onMove={() =>
									setMoveDialog({
										open: true,
										items: [toSceneRef(scene)],
										projectId: scene.projectId
									})
								}
								onDelete={() =>
									setDeleteDialog({ open: true, items: [toSceneRef(scene)] })
								}
							/>
						))}
					</div>
				</section>
			) : null}
			{/*
			  No second empty state here. With zero scenes the overview above already
			  shows the first-scene call to action; a "no recent scenes yet" panel
			  underneath it said the same thing again, without a way forward.
			*/}
		</div>
	)
}

export default DashboardPage
