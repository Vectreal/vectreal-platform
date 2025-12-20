/**
 * Dashboard Action Buttons
 * @description Centralized action buttons component for different dashboard views
 */

import { Button } from '@shared/components/ui/button'
import { Edit, Folder, FolderOpen, Plus, Rocket } from 'lucide-react'
import { memo } from 'react'
import { Link, useParams } from 'react-router'

import { ACTION_VARIANT } from '../../types/dashboard'

interface DashboardActionsProps {
	variant: ACTION_VARIANT
	className?: string
}

/**
 * DashboardActions component renders contextual action buttons
 * Based on the current variant
 * Memoized to prevent unnecessary re-renders
 */
export const DashboardActions = memo<DashboardActionsProps>(
	({ variant, className }) => {
		const { sceneId } = useParams()
		const getActions = () => {
			switch (variant) {
				case ACTION_VARIANT.DASHBOARD:
					return (
						<div className="flex gap-2">
							<Link viewTransition to="/dashboard/projects/new">
								<Button className="flex items-center">
									<Plus className="mr-2 h-4 w-4" />
									New Project
								</Button>
							</Link>
							<Link viewTransition to="/dashboard/projects">
								<Button variant="outline">
									<FolderOpen className="mr-2 h-4 w-4" />
									Browse Projects
								</Button>
							</Link>
							<Link viewTransition to="/dashboard/organizations">
								<Button variant="outline">
									<Folder className="mr-2 h-4 w-4" />
									Manage Organizations
								</Button>
							</Link>
						</div>
					)
				case ACTION_VARIANT.PROJECT_LIST:
					return (
						<Link viewTransition to="/dashboard/projects/new">
							<Button>
								<Plus className="mr-2 h-4 w-4" />
								New Project
							</Button>
						</Link>
					)

				case ACTION_VARIANT.CREATE_PROJECT:
					return (
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							Create Project
						</Button>
					)

				case ACTION_VARIANT.PROJECT_DETAIL:
					return (
						<div className="flex gap-2">
							<Button variant="outline">
								<Plus className="mr-2 h-4 w-4" />
								New Folder
							</Button>
							<Link viewTransition to="/publisher">
								<Button>
									<Rocket className="mr-2 h-4 w-4" />
									New Scene
								</Button>
							</Link>
						</div>
					)

				case ACTION_VARIANT.FOLDER_DETAIL:
					return (
						<div className="flex gap-2">
							<Button variant="outline">
								<Plus className="mr-2 h-4 w-4" />
								New Folder
							</Button>
							<Link viewTransition to="/publisher">
								<Button>
									<Rocket className="mr-2 h-4 w-4" />
									New Scene
								</Button>
							</Link>
						</div>
					)

				case ACTION_VARIANT.SCENE_DETAIL:
					return (
						<Link viewTransition to={`/publisher/${sceneId}`}>
							<Button>
								<Edit className="mr-2 h-4 w-4" />
								Edit Scene
							</Button>
						</Link>
					)

				default:
					return null
			}
		}

		const actions = getActions()

		if (!actions) {
			return null
		}

		return <div className={className}>{actions}</div>
	}
)

DashboardActions.displayName = 'DashboardActions'
