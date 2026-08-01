import { cn } from '@shared/utils'

export interface SceneStatusCounts {
	published: number
	draft: number
	archived: number
}

/**
 * Published leads because it is the state that costs a quota slot and the one
 * users check for. Archived is only shown when there is some.
 */
const STATUS_STYLES = [
	{ key: 'published', label: 'published', dot: 'bg-success' },
	{ key: 'draft', label: 'draft', dot: 'bg-muted-foreground/60' },
	{ key: 'archived', label: 'archived', dot: 'bg-muted-foreground/30' }
] as const

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
	const visible = STATUS_STYLES.filter(
		// Archived is noise until it exists; draft and published always show, so
		// an all-draft project still reads as "0 published".
		(status) => counts[status.key] > 0 || status.key !== 'archived'
	)

	const total = counts.published + counts.draft + counts.archived
	if (total === 0) {
		return (
			<span className={cn('text-muted-foreground text-xs', className)}>
				No scenes yet
			</span>
		)
	}

	return (
		<div
			className={cn(
				'text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs',
				className
			)}
		>
			{visible.map((status) => (
				<span key={status.key} className="flex items-center gap-1.5">
					<span
						className={cn('size-1.5 shrink-0 rounded-full', status.dot)}
						aria-hidden="true"
					/>
					<span className="tabular-nums">{counts[status.key]}</span>
					{verbose ? <span>{status.label}</span> : null}
					<span className="sr-only">{status.label}</span>
				</span>
			))}
		</div>
	)
}
