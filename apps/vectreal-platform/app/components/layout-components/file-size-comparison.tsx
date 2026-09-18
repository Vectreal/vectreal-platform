import { cn, formatFileSize } from '@shared/utils'
import { motion, useReducedMotion } from 'framer-motion'

import type { FC } from 'react'

/*
  Moved here from `publisher/sidebars/` when the converter grew a before/after.

  It never had anything publisher-specific in it - no shell classes, no scene, no
  optimizer - it just happened to be written where it was first needed. The
  converter shows the same fact (this many bytes became that many) and the two
  should not drift into two treatments of one number.
*/

/**
 * The two readings drawn from a before and an after.
 *
 * Both call sites answer the same question about the same component and had
 * written the same arithmetic twice. The percentage is deliberately `null` when
 * the file grew: "-−14%" is not a reading, and the honest version of that case
 * is the delta label alone, which says "larger" in words. That case is not
 * hypothetical on the converter - USDZ inflates every model it is given.
 */
export function describeSizeChange(
	before: number | null | undefined,
	after: number | null | undefined
): { reductionPercent: number | null; deltaLabel: string | null } {
	if (typeof before !== 'number' || typeof after !== 'number') {
		return { reductionPercent: null, deltaLabel: null }
	}

	const delta = before - after

	return {
		reductionPercent:
			before > 0 && after < before ? Math.round((delta / before) * 100) : null,
		deltaLabel:
			delta > 0
				? `${formatFileSize(delta)} smaller`
				: delta < 0
					? `${formatFileSize(Math.abs(delta))} larger`
					: 'No size change'
	}
}

export interface FileSizeComparisonSizeInfo {
	initialSceneBytes?: number | null
	currentSceneBytes?: number | null
	isInitialMetricsHydrating?: boolean
}

interface FileSizeComparisonProps {
	sizeInfo: FileSizeComparisonSizeInfo
	reductionPercent?: number | null
	deltaLabel?: string | null
}

interface BarProps {
	label: string
	value: string
	/** Share of the wider of the two readings, 0-100. */
	percent: number | null
	tone: string
	delay: number
}

const Bar: FC<BarProps> = ({ label, value, percent, tone, delay }) => {
	const prefersReducedMotion = useReducedMotion()

	return (
		<div className="flex items-center gap-4">
			<span className="text-muted-foreground text-label-xs w-12 shrink-0">
				{label}
			</span>

			{percent !== null && (
				<div className="bg-foreground/10 h-2 min-w-0 flex-1 rounded-full">
					<motion.div
						className={cn('h-2 rounded-full', tone)}
						initial={prefersReducedMotion ? false : { width: 0 }}
						animate={{ width: `${percent}%` }}
						transition={{ duration: 0.5, delay, ease: 'easeOut' }}
					/>
				</div>
			)}

			<span className="text-foreground text-body-sm w-20 shrink-0 text-right tabular-nums">
				{value}
			</span>
		</div>
	)
}

/**
 * What the conversion did to the file, as one answer and its evidence.
 *
 * WHY IT IS SHAPED LIKE THIS. The question a reader brings is "did this make my
 * file smaller, and by how much" - one question with one answer. The previous
 * version set the two operands side by side at the largest size on the panel and
 * put the answer between them in the smallest text it had, so the thing being
 * asked was the hardest thing to read, and brand orange - which has exactly one
 * job, marking what the reader is looking at - was on the *before* figure, the
 * one number nobody came for.
 *
 * So the change is the headline, the two sizes are evidence under it, and the
 * evidence is drawn as two bars against a shared scale. A proportion is the one
 * thing a bar says better than a sentence, and it is the same fact the numbers
 * carry, so nobody has to divide 425 by 944 in their head to find out whether
 * that was a good result.
 *
 * Both directions fall out of the same drawing rather than needing a case:
 * bars are measured against the larger reading, so a file that shrank has a
 * short second bar and a file that grew has a short first one. The accent is
 * spent only on a reduction, because that is the only outcome it would be
 * honest to celebrate - USDZ inflates every model it is handed, and an orange
 * bar saying so would be reading as a win.
 */
export const FileSizeComparison: FC<FileSizeComparisonProps> = ({
	sizeInfo,
	reductionPercent,
	deltaLabel
}) => {
	const initialFileSize = sizeInfo.initialSceneBytes ?? null
	const currentFileSize = sizeInfo.currentSceneBytes ?? initialFileSize
	const isHydratingInitialMetrics =
		Boolean(sizeInfo.isInitialMetricsHydrating) && initialFileSize === null

	const formatValue = (value: number | null) =>
		value === null
			? isHydratingInitialMetrics
				? 'Loading...'
				: '-'
			: formatFileSize(value)

	/*
	  Bars are only meaningful once both readings are real numbers and at least
	  one of them is above zero. Until then the rows still render their labels and
	  values, so the panel does not change shape when the figures arrive.
	*/
	const widest = Math.max(initialFileSize ?? 0, currentFileSize ?? 0)
	const share = (value: number | null) =>
		value === null || widest <= 0 ? null : (value / widest) * 100

	const didShrink = reductionPercent != null
	const headline = didShrink ? `-${reductionPercent}%` : deltaLabel

	return (
		<div>
			{headline && (
				<p
					className={cn(
						'text-h2 tabular-nums',
						didShrink ? 'text-orange' : 'text-foreground'
					)}
				>
					{headline}
				</p>
			)}
			{didShrink && deltaLabel && (
				<p className="text-muted-foreground text-body-sm mt-1">{deltaLabel}</p>
			)}

			<div className={cn('space-y-3', headline && 'mt-4')}>
				<Bar
					label="Before"
					value={formatValue(initialFileSize)}
					percent={share(initialFileSize)}
					tone="bg-foreground/25"
					delay={0}
				/>
				<Bar
					label="After"
					value={formatValue(currentFileSize)}
					percent={share(currentFileSize)}
					tone={didShrink ? 'bg-orange' : 'bg-foreground/50'}
					delay={0.1}
				/>
			</div>
		</div>
	)
}
