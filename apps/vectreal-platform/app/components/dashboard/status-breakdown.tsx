import { cn } from '@shared/utils'

import { SCENE_STATUS_DOT } from './scene-status'

export interface SceneStatusCounts {
	published: number
	draft: number
	archived: number
}

/*
	The order is the reading order, and it is keyed to `SCENE_STATUS_DOT` so a
	fourth status cannot be added to the vocabulary and silently never appear in
	a project's breakdown. The colours themselves belong to that module, which
	owns why they are what they are.
*/
const STATUS_ORDER = [
	'published',
	'draft',
	'archived'
] as const satisfies readonly (keyof typeof SCENE_STATUS_DOT)[]

interface StatusBreakdownProps {
	counts: SceneStatusCounts
	/** Spells out the status names; otherwise it is dots and numbers only. */
	verbose?: boolean
	className?: string
}

/**
 * How a project's scenes divide across draft, published and archived.
 *
 * The dashboard loader already computes this per project and throws it away,
 * so a project row could only ever say "12 scenes" - which does not answer the
 * question people actually have about a project, namely how much of it is live.
 */
export function StatusBreakdown({
	counts,
	verbose,
	className
}: StatusBreakdownProps) {
	const visible = STATUS_ORDER.filter(
		// Archived is noise until it exists; draft and published always show, so
		// an all-draft project still reads as "0 published".
		(status) => counts[status] > 0 || status !== 'archived'
	)

	const total = counts.published + counts.draft + counts.archived
	if (total === 0) {
		return (
			<span className={cn('text-muted-foreground text-label-xs', className)}>
				No scenes yet
			</span>
		)
	}

	return (
		<div
			className={cn(
				'text-muted-foreground text-label-xs flex flex-wrap items-center gap-x-3 gap-y-1',
				className
			)}
		>
			{visible.map((status) => (
				<span key={status} className="flex items-center gap-1.5">
					<span
						className={cn(
							'size-1.5 shrink-0 rounded-full',
							SCENE_STATUS_DOT[status]
						)}
						aria-hidden="true"
					/>
					<span className="tabular-nums">{counts[status]}</span>
					{verbose ? <span className="capitalize">{status}</span> : null}
					<span className="sr-only">{status}</span>
				</span>
			))}
		</div>
	)
}
