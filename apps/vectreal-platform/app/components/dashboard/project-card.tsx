import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { cn } from '@shared/utils'
import { Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { SceneThumbnail } from './scene-thumbnail'
import { StatusBreakdown, type SceneStatusCounts } from './status-breakdown'
import { useIsClientMounted } from '../../hooks/use-is-client-mounted'

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
export function ProjectCard({
	project,
	className,
	onDelete,
	canDelete = false
}: ProjectCardProps) {
	const isClientMounted = useIsClientMounted()
	const location = useLocation()

	return (
		<div className={cn('group/card relative', className)}>
			<Link
				to={`/dashboard/projects/${project.id}`}
				viewTransition
				className="ds-raised-interactive block overflow-hidden rounded-2xl"
			>
				<SceneThumbnail src={project.thumbnailUrl} className="rounded-none" />

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

			  A menu rather than the bare pencil this used to be: the card had no way
			  to delete a project at all, and two hover-revealed icon buttons in one
			  corner is already crowded before adding a destructive one.
			*/}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						disabled={!isClientMounted}
						aria-label={`Actions for ${project.name}`}
						/*
						  Always present, on its own scrim. This used to be `opacity-0`
						  until hover, sitting bare on the thumbnail - against a light
						  image it was invisible even while hovered, and hover-reveal has
						  no touch equivalent, so on a tablet the menu was unreachable.
						*/
						className="bg-background/70 hover:bg-background focus-visible:bg-background data-[state=open]:bg-background absolute top-2 right-2 backdrop-blur-sm transition-colors"
					>
						<Ellipsis className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
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
							Only organization owners can delete a project.
						</p>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	)
}
