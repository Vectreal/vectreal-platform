import { Progress } from '@shared/components/ui/progress'
import { cn } from '@shared/utils'

import { InfoTooltip } from '../info-tooltip'

import type { ReactNode } from 'react'

/** At or above this share of the limit, the meter warns. */
const WARNING_AT = 80
/** At or above this, it is critical - the next action is likely to be refused. */
const CRITICAL_AT = 95

export type UsageLevel = 'ok' | 'warning' | 'critical'

export interface UsageReading {
	unlimited: boolean
	percent: number
	level: UsageLevel
}

/**
 * Where a usage figure sits against its limit.
 *
 * `limit === null` means unlimited, which every plan above free uses for at
 * least one key - so it is a first-class case, not an edge one. An unlimited
 * meter is never a warning however large the number gets.
 */
export function readUsage(current: number, limit: null | number): UsageReading {
	if (limit === null || limit <= 0) {
		return { unlimited: true, percent: 0, level: 'ok' }
	}

	const percent = Math.min(Math.round((current / limit) * 100), 100)

	return {
		unlimited: false,
		percent,
		level:
			percent >= CRITICAL_AT
				? 'critical'
				: percent >= WARNING_AT
					? 'warning'
					: 'ok'
	}
}

/** True when any reading deserves the user's attention. */
export function hasUsagePressure(readings: UsageReading[]) {
	return readings.some((reading) => reading.level !== 'ok')
}

/*
  Warning is `--warning` (amber), not `--orange`.

  The billing page used the brand colour to mean "approaching your limit", which
  is the same mistake as the newsroom's `text-primary`-as-accent: reaching for a
  colour that already means something else. Orange is the brand, and it is used
  below to mark the state a user cares about - it cannot also mean "careful".
  Only these two semantic tokens appear here, and only for their semantics.
*/
const LEVEL_TEXT: Record<UsageLevel, string> = {
	ok: '',
	warning: 'text-warning',
	critical: 'text-destructive'
}

const LEVEL_BAR: Record<UsageLevel, string> = {
	ok: '',
	warning: '[&>div]:bg-warning',
	critical: '[&>div]:bg-destructive'
}

interface UsageMeterProps {
	label: ReactNode
	current: number
	/** `null` for unlimited. */
	limit: null | number
	/** Appends "/mo" to the label for per-period limits. */
	monthly?: boolean
	/**
	 * Explains what the figure counts, behind an info trigger beside the label.
	 *
	 * For meters whose number invites a reasonable "that looks wrong" - storage
	 * is the one that does - rather than for restating the label.
	 */
	hint?: ReactNode
	/**
	 * `tile` is a standalone block for a grid; `row` is a compact line for a
	 * list. They differ only in layout - the reading and its colours are shared.
	 */
	variant?: 'tile' | 'row'
	/** Defaults to `toLocaleString`. Pass one for bytes, requests, and so on. */
	format?: (value: number) => string
	className?: string
}

/**
 * A usage figure against its plan limit.
 *
 * The billing page had two of these - `StatTile` and `MeterRow` - written out
 * separately in one file, each recomputing the same percentage and repeating
 * the same 80/95 thresholds. They are one component with two layouts, which
 * matters now that the dashboard shows the same readings: a threshold that
 * disagrees between two screens is worse than no threshold.
 */
export function UsageMeter({
	label,
	current,
	limit,
	monthly,
	hint,
	variant = 'tile',
	format = (value) => value.toLocaleString(),
	className
}: UsageMeterProps) {
	const { unlimited, percent, level } = readUsage(current, limit)
	const limitLabel = limit === null || limit <= 0 ? '∞' : format(limit)
	const value = `${format(current)} / ${limitLabel}`

	const bar = unlimited ? (
		// A flat rail rather than no rail: the meters stay aligned in a grid
		// whether or not a given key is capped on this plan.
		<div className="ds-sunken h-1 rounded-full" />
	) : (
		<Progress value={percent} className={cn('h-1', LEVEL_BAR[level])} />
	)

	if (variant === 'row') {
		return (
			<div className={cn('space-y-1.5', className)}>
				<div className="flex items-center justify-between gap-2">
					<span className="text-muted-foreground flex items-center gap-1 text-xs">
						{label}
						{monthly ? (
							<span className="text-muted-foreground/50">/mo</span>
						) : null}
						{hint ? <InfoTooltip content={hint} className="size-3.5" /> : null}
					</span>
					<span
						className={cn(
							'text-xs font-medium tabular-nums',
							LEVEL_TEXT[level]
						)}
					>
						{value}
					</span>
				</div>
				{unlimited ? null : bar}
			</div>
		)
	}

	return (
		<div className={cn('ds-sunken space-y-3 rounded-xl p-4', className)}>
			<p className="text-muted-foreground text-eyebrow flex items-center gap-1.5">
				<span>
					{label}
					{monthly ? (
						<span className="text-muted-foreground/60 ml-1 tracking-normal normal-case">
							/mo
						</span>
					) : null}
				</span>
				{hint ? <InfoTooltip content={hint} className="size-3.5" /> : null}
			</p>
			<p
				className={cn(
					'text-2xl font-semibold tracking-tight tabular-nums',
					LEVEL_TEXT[level]
				)}
			>
				{format(current)}
				<span className="text-muted-foreground ml-0.5 text-sm font-normal">
					{` / ${limitLabel}`}
				</span>
			</p>
			{bar}
		</div>
	)
}

interface UsageMeterGridProps {
	children: ReactNode
	className?: string
}

/** Responsive grid for `UsageMeter` tiles. */
export function UsageMeterGrid({ children, className }: UsageMeterGridProps) {
	return (
		<div
			className={cn(
				'grid grid-cols-2 gap-3 lg:grid-cols-4',
				className
			)}
		>
			{children}
		</div>
	)
}
