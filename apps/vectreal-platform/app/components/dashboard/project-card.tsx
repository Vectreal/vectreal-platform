import { DropdownMenuItem } from '@shared/components/ui/dropdown-menu'
import { Pencil, Trash2 } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { EntityCard } from './entity-card'
import { RelativeTime } from './relative-time'
import { StatusBreakdown, type SceneStatusCounts } from './status-breakdown'
import { describeDashboardOperationRequirement } from '../../lib/domain/dashboard/dashboard-operations'

export interface ProjectCardData {
	id: string
	name: string
	organizationName: string
	counts: SceneStatusCounts
	/** From the project's most recently updated scene that has one. */
	thumbnailUrl?: null | string
	/**
	 * Null when the project has no scenes. `projects` has no timestamp column of
	 * its own, so this is derived from its scenes - and a project without scenes
	 * genuinely has no date rather than one of today.
	 */
	updatedAt: Date | null
}

interface ProjectCardProps {
	project: ProjectCardData
	className?: string
	/** Omit to render the card without an actions menu at all. */
	onDelete?: (project: ProjectCardData) => void
	canDelete?: boolean
}

/**
 * A project at a glance.
 *
 * What is particular to a project: the thumbnail is borrowed from its most
 * recent scene, the state line is how its scenes divide across draft and
 * published, and the menu edits or deletes the project. The card around all of
 * that is `EntityCard`, shared with scenes.
 */
export function ProjectCard({
	project,
	className,
	onDelete,
	canDelete = false
}: ProjectCardProps) {
	const location = useLocation()

	return (
		<EntityCard
			className={className}
			to={`/dashboard/projects/${project.id}`}
			title={project.name}
			subtitle={project.organizationName}
			thumbnailUrl={project.thumbnailUrl}
			status={<StatusBreakdown counts={project.counts} />}
			footer={
				/*
				  Null means the project has no scenes, and `StatusBreakdown` above
				  already says so. This used to answer "No scenes yet" here as well,
				  so an empty project said it twice - once as a fact about its
				  scenes and once as a fact about a date it does not have.
				*/
				project.updatedAt ? (
					<>
						Updated <RelativeTime at={project.updatedAt} />
					</>
				) : null
			}
			menuItems={
				<>
					<DropdownMenuItem asChild>
						<Link
							// Carries the list's view and filters - see the table's edit link.
							to={{
								pathname: `/dashboard/projects/edit/${project.id}`,
								search: location.search
							}}
							className="flex w-full items-center gap-2"
						>
							<Pencil className="mr-2 size-4" />
							Edit project
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!canDelete || !onDelete}
						onClick={() => onDelete?.(project)}
						className="text-destructive focus:bg-destructive/10 focus:text-destructive"
					>
						<Trash2 className="mr-2 size-4" />
						Delete project
					</DropdownMenuItem>
					{!canDelete ? (
						<p className="text-muted-foreground px-2 py-1.5 text-xs">
							{describeDashboardOperationRequirement('project:delete')}
						</p>
					) : null}
				</>
			}
		/>
	)
}
