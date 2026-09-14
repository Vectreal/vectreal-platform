import { DropdownMenuItem } from '@shared/components/ui/dropdown-menu'
import { FolderInput, Trash2 } from 'lucide-react'

import { EntityCard } from './entity-card'
import { RelativeTime } from './relative-time'
import { SceneStatusTag } from './scene-status'

import type { SceneStatus } from '../../lib/domain/dashboard/dashboard-confirmation'

/**
 * A scene as every dashboard list needs it.
 *
 * One shape, because the card and the resume band render the same row from the
 * same loader mapping and each used to declare its own copy of these seven
 * fields.
 */
export interface SceneSummary {
	id: string
	name: string
	projectId: string
	projectName: string
	status: SceneStatus
	thumbnailUrl?: null | string
	updatedAt: Date | string
}

interface SceneCardProps {
	scene: SceneSummary
	className?: string
	onMove?: (scene: SceneSummary) => void
	onDelete?: (scene: SceneSummary) => void
}

/**
 * A scene at a glance.
 *
 * The half of `EntityCard` that belongs to a scene: its own thumbnail, the
 * project it sits in, its publish state, and the two things you can do to it
 * from a list.
 *
 * A card rather than a table row, on the surface where the question is "which
 * one was I working on". That is answered by recognising a picture, not by
 * comparing seven columns - and the picture the table did carry was 36px in a
 * name cell, small enough to read as an icon rather than as the thing itself.
 */
export function SceneCard({
	scene,
	className,
	onMove,
	onDelete
}: SceneCardProps) {
	return (
		<EntityCard
			className={className}
			to={`/dashboard/projects/${scene.projectId}/${scene.id}`}
			title={scene.name}
			subtitle={scene.projectName}
			thumbnailUrl={scene.thumbnailUrl}
			status={<SceneStatusTag status={scene.status} />}
			footer={
				<>
					Edited <RelativeTime at={scene.updatedAt} />
				</>
			}
			menuItems={
				onMove || onDelete ? (
					<>
						<DropdownMenuItem
							disabled={!onMove}
							onClick={() => onMove?.(scene)}
						>
							<FolderInput className="mr-2 size-4" />
							Move to...
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={!onDelete}
							onClick={() => onDelete?.(scene)}
							className="text-destructive focus:bg-destructive/10 focus:text-destructive"
						>
							<Trash2 className="mr-2 size-4" />
							Delete scene
						</DropdownMenuItem>
					</>
				) : undefined
			}
		/>
	)
}
