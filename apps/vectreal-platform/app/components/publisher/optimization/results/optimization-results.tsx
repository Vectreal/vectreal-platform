import { formatFileSize } from '@shared/utils'
import { motion } from 'framer-motion'
import { useMemo } from 'react'

import { BeforeAfter, MetricRow, formatBytes, formatCount } from './metric-row'
import { FileSizeComparison } from '../../sidebars/file-size-comparison'

import type { resolveSceneMetrics } from '../../../../lib/domain/scene'
import type { SimplificationOutcome } from '../model'
import type { SizeInfo } from '../use-optimization-process'
import type { DracoCompressionReport } from '@vctrl/core'
import type { FC } from 'react'

interface OptimizationResultsProps {
	sizeInfo: SizeInfo
	resolvedMetrics: ReturnType<typeof resolveSceneMetrics>
	dracoReport: DracoCompressionReport | null
	simplificationOutcome: SimplificationOutcome | null
}

export const OptimizationResults: FC<OptimizationResultsProps> = ({
	sizeInfo,
	resolvedMetrics,
	dracoReport,
	simplificationOutcome
}) => {
	const { reductionPercent, deltaLabel } = useMemo(() => {
		const before = resolvedMetrics.sceneBytes.initial
		const after = resolvedMetrics.sceneBytes.current

		if (typeof before !== 'number' || typeof after !== 'number') {
			return { reductionPercent: null, deltaLabel: null }
		}

		const delta = before - after
		return {
			reductionPercent:
				before > 0 && after < before
					? Math.round((delta / before) * 100)
					: null,
			deltaLabel:
				delta > 0
					? `${formatFileSize(delta)} smaller`
					: delta < 0
						? `${formatFileSize(Math.abs(delta))} larger`
						: 'No size change'
		}
	}, [resolvedMetrics.sceneBytes])

	return (
		<motion.div
			key="post-opt-metrics"
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -8 }}
			transition={{ duration: 0.3 }}
			className="publisher-shell-nested space-y-1 px-4 pt-3 pb-1"
		>
			<p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
				Optimization result
			</p>

			<FileSizeComparison
				sizeInfo={sizeInfo}
				reductionPercent={reductionPercent}
				deltaLabel={deltaLabel}
			/>

			<div className="space-y-2 pb-3 text-xs">
				{/* Draco leads: it is usually the largest single saving. */}
				{dracoReport ? (
					<MetricRow label="Geometry (Draco)">
						{dracoReport.isWorthApplying ? (
							<BeforeAfter
								before={formatBytes(dracoReport.geometryBytesBefore)}
								after={formatBytes(dracoReport.geometryBytesAfterCompression)}
								suffix={`(-${Math.round(dracoReport.reductionPercent)}%)`}
							/>
						) : (
							<span className="text-muted-foreground">
								Skipped — no size gain
							</span>
						)}
					</MetricRow>
				) : null}

				{sizeInfo.workingSceneBytes != null ? (
					<MetricRow label="Before Draco">
						<span className="text-muted-foreground">
							{formatBytes(sizeInfo.workingSceneBytes)}
						</span>
					</MetricRow>
				) : null}

				<MetricRow label="Triangles">
					<BeforeAfter
						before={formatCount(resolvedMetrics.primitives.initial)}
						after={formatCount(resolvedMetrics.primitives.current)}
					/>
				</MetricRow>

				{/*
				  Measured, not projected. The old panel showed an estimate derived
				  from the target ratio alone, which could not account for the
				  deviation limit stopping the simplifier early.
				*/}
				{simplificationOutcome?.fellShort ? (
					<p className="text-muted-foreground text-[11px] leading-relaxed">
						Polygon reduction stopped at{' '}
						{Math.round((1 - simplificationOutcome.achievedKeepRatio) * 100)}%
						of the requested{' '}
						{Math.round((1 - simplificationOutcome.requestedKeepRatio) * 100)}%
						— the deviation limit was reached first. Raise it to allow more
						reduction, at the cost of shape accuracy.
					</p>
				) : null}

				<MetricRow label="Texture size">
					<BeforeAfter
						before={formatBytes(resolvedMetrics.textureBytes.initial)}
						after={formatBytes(resolvedMetrics.textureBytes.current)}
					/>
				</MetricRow>
			</div>
		</motion.div>
	)
}
