import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { Pencil } from 'lucide-react'
import { Link } from 'react-router'

import { SceneThumbnail } from './scene-thumbnail'
import { StatusBreakdown, type SceneStatusCounts } from './status-breakdown'

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
}

function formatUpdated(updatedAt: Date | null) {
	if (!updatedAt) {
		return 'No scenes yet'
	}

	const days = Math.floor((Date.now() - updatedAt.getTime()) / 86_400_000)
	if (days < 1) return 'Updated today'
	if (days === 1) return 'Updated yesterday'
	if (days < 30) return `Updated ${days} days ago`

	return `Updated ${updatedAt.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})}`
}

/**
 * A project at a glance.
 *
 * The card carries what the table could not: a thumbnail borrowed from the
 * project's most recent scene, and how its scenes divide across draft and
 * published. Both come from data the loader already had in hand.
 */
export function ProjectCard({ project, className }: ProjectCardProps) {
	return (
		<div className={cn('group/card relative', className)}>
			<Link
				to={`/dashboard/projects/${project.id}`}
				viewTransition
				className="ds-raised-interactive block overflow-hidden rounded-2xl"
			>
				<SceneThumbnail
					src={project.thumbnailUrl}
					name={project.name}
					className="rounded-none"
				/>

				<div className="space-y-2 p-4">
					<div className="min-w-0">
						<p className="truncate font-medium">{project.name}</p>
						<p className="text-muted-foreground truncate text-xs">
							{project.organizationName}
						</p>
					</div>

					<StatusBreakdown counts={project.counts} />

					<p className="text-muted-foreground text-label-xs">
						{formatUpdated(project.updatedAt)}
					</p>
				</div>
			</Link>

			{/*
			  Outside the card link rather than inside it: nesting an anchor in an
			  anchor is invalid, and the browser resolves it by dropping one of them.
			*/}
			<Button
				variant="ghost"
				size="icon"
				asChild
				className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100"
			>
				<Link to={`/dashboard/projects/${project.id}/edit`}>
					<Pencil className="size-4" />
					<span className="sr-only">Edit {project.name}</span>
				</Link>
			</Button>
		</div>
	)
}
