import { Progress } from '@shared/components/ui/progress'
import { Skeleton } from '@shared/components/ui/skeleton'
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

	/*
	  A limit of one, met, is the shape of the plan rather than pressure.

	  Free allows a single project and creates it at signup, so every free
	  organization sits at 1 of 1 from the moment it exists; `org_seats` is the
	  same. Scored as critical it paints a permanent red bar nobody can clear,
	  which is what made the dashboard band cry wolf at every new account. The
	  reading is still full - a second project really is refused - so the figure
	  and the rail are honest; only the alarm is wrong.
	*/
	const percent = Math.min(Math.round((current / limit) * 100), 100)

	if (limit === 1) {
		return { unlimited: false, percent, level: 'ok' }
	}

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
  is the same mistake as the newsroom's `text-foreground`-as-accent: reaching for a
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
 * The readings, laid out.
 *
 * One owner for the columns, because the page and its loading state both need
 * them and a skeleton that restates a layout is a copy that drifts - the
 * billing skeleton describes two rounds of exactly that. Here the skeleton
 * renders this same wrapper around loading meters, so it cannot promise a shape
 * the page does not have.
 *
 * A column is about as wide as a phone at any viewport, so the row design that
 * works at 375px is the one running everywhere. Single column below `sm`, where
 * two put a wrapped label beside an unwrapped one and knocked the numbers in a
 * row out of line. No override hook: the last wrapper here took a `className`
 * so callers could restate the column count, and they disagreed with it.
 *
 * It is a grid with two responsive steps, not one layout at every width, and
 * the last column can still come up short - three readings then two. That is
 * fine for rows in a way it was not for tiles: a list ending is a list ending,
 * where a missing tile is a hole with an edge around it.
 */
export function UsageMeterList({ children }: { children: ReactNode }) {
	return (
		<div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
			{children}
		</div>
	)
}

/** The row, with nothing in it yet. Same DOM, so the page cannot shift on load. */
export function UsageMeterRowSkeleton({ delayMs = 0 }: { delayMs?: number }) {
	return (
		<div className="space-y-1.5">
			<div className="flex items-baseline justify-between gap-3">
				<Skeleton
					className="h-4 w-24"
					style={{ animationDelay: `${delayMs}ms` }}
				/>
				<Skeleton
					className="h-4 w-28"
					style={{ animationDelay: `${delayMs + 30}ms` }}
				/>
			</div>
			<Skeleton
				className="h-1 w-full"
				style={{ animationDelay: `${delayMs + 60}ms` }}
			/>
		</div>
	)
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

	/*
		A cap you cannot act on gets a quiet rail.

		`readUsage` already declines to raise an alarm for `limit === 1` - a free
		organization is at 1 of 1 projects from signup and that is the plan, not
		pressure - but the rail still filled to 100% in the default near-black
		`--primary`, which made it the highest-contrast thing in a panel headed
		"Nothing needs your attention." The alarm was suppressed in colour and
		reasserted in value, which is the louder channel of the two.
	*/
	const isPlanShapedCap = limit === 1 && current >= 1

	const bar = unlimited ? (
		// A flat rail rather than no rail: the meters stay aligned in a grid
		// whether or not a given key is capped on this plan.
		<div className="ds-sunken h-1 rounded-full" />
	) : (
		<Progress
			value={percent}
			className={cn(
				'h-1',
				isPlanShapedCap ? '[&>div]:bg-muted-foreground/40' : LEVEL_BAR[level]
			)}
		/>
	)

	/*
	  What is left, which is the question. "4 / 10" makes a reader do the
	  subtraction, and the whole reason to open this page is to find out whether
	  there is room for the next thing.

	  It belongs to the reading rather than to a layout. The row variant used to
	  omit it and show the raw pair, so the same meter answered the page's own
	  question in one shape and not the other.
	*/
	const remainingLabel = unlimited
		? 'No limit'
		: current >= (limit ?? 0)
			? 'At the limit'
			: `${format((limit ?? 0) - current)} left`

	if (variant === 'row') {
		return (
			<div className={cn('space-y-1.5', className)}>
				<div className="flex items-baseline justify-between gap-3">
					{/*
					  Wraps rather than truncates. At 375px "Scene storage" became
					  "Scene stora...", which hides the one thing a row cannot lose -
					  which reading it is. Rows stack, so a second line costs height
					  in one row and disturbs nothing beside it.
					*/}
					<span className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm">
						<span>{label}</span>
						{monthly ? (
							<span className="text-muted-foreground/50">/mo</span>
						) : null}
						{hint ? <InfoTooltip content={hint} className="size-3.5" /> : null}
					</span>
					<span className="flex shrink-0 items-baseline gap-2 tabular-nums">
						<span className={cn('text-sm font-medium', LEVEL_TEXT[level])}>
							{remainingLabel}
						</span>
						<span className="text-muted-foreground text-xs">{value}</span>
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
			<p
				className={cn('text-xs', LEVEL_TEXT[level] || 'text-muted-foreground')}
			>
				{remainingLabel}
			</p>
		</div>
	)
}

/*
	`UsageMeterGrid` used to live here: `grid-cols-2 lg:grid-cols-4`, with callers
	overriding the large step to match how many meters they had.

	It is gone because the arithmetic never worked. Five readings over three
	columns leave the last one alone beside two empty cells - and on the usage
	route that orphan was scene storage, on a page about storage. Two columns on a
	phone put a wrapped label ("Published scenes") beside an unwrapped one
	("Folders"), so the numbers in a row sat at different heights. There was no
	`md` step at all, so a tablet got the phone layout.

	A column of rows has none of those states. It is the same layout at every
	width, so there is no responsive branch to get wrong, and a reading can be
	added or removed without anyone recounting the columns.
*/
