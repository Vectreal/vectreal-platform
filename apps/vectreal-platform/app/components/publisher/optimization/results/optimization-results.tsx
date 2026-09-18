import { formatFileSize } from '@shared/utils'
import { motion } from 'framer-motion'

import { BeforeAfter, MetricRow, formatCount } from './metric-row'
import {
	describeSizeChange,
	FileSizeComparison
} from '../../../layout-components/file-size-comparison'

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
	const { reductionPercent, deltaLabel } = describeSizeChange(
		resolvedMetrics.sceneBytes.initial,
		resolvedMetrics.sceneBytes.current
	)

	return (
		<motion.div
			key="post-opt-metrics"
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -8 }}
			transition={{ duration: 0.3 }}
			className="publisher-shell-nested rounded-xl p-4"
		>
			<p className="text-muted-foreground text-eyebrow mb-1">
				Optimization result
			</p>

			<FileSizeComparison
				sizeInfo={sizeInfo}
				reductionPercent={reductionPercent}
				deltaLabel={deltaLabel}
			/>

			{/*
			  A rule and a real gap, because this is the breakdown and everything
			  above it is the summary. Both are label-left/value-right rows of the
			  same shape, so at 4px apart the two bars and the four metrics read as
			  one undifferentiated list of six - which is what made a panel with
			  ordinary padding still look crammed.
			*/}
			<div className="border-border/60 mt-4 space-y-2 border-t pt-4 text-xs">
				{/* Draco leads: it is usually the largest single saving. */}
				{dracoReport ? (
					<MetricRow label="Geometry (Draco)">
						{dracoReport.isWorthApplying ? (
							<BeforeAfter
								before={formatFileSize(dracoReport.geometryBytesBefore)}
								after={formatFileSize(
									dracoReport.geometryBytesAfterCompression
								)}
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
							{formatFileSize(sizeInfo.workingSceneBytes)}
						</span>
					</MetricRow>
				) : null}

				{/*
				  Mesh simplification is the only step that changes the triangle
				  count, and it is off in every shipped preset, so a before/after pair
				  here reads as a failed reduction when nothing was ever asked to
				  reduce. Show the plain count unless simplification actually ran.
				*/}
				<MetricRow label="Triangles">
					{simplificationOutcome ? (
						<BeforeAfter
							before={formatCount(resolvedMetrics.primitives.initial)}
							after={formatCount(resolvedMetrics.primitives.current)}
						/>
					) : (
						<span className="text-muted-foreground">
							{formatCount(resolvedMetrics.primitives.current)}
						</span>
					)}
				</MetricRow>

				{/*
				  Measured, not projected. The old panel showed an estimate derived
				  from the target ratio alone, which could not account for the
				  deviation limit stopping the simplifier early.
				*/}
				{simplificationOutcome?.fellShort ? (
					<p className="text-muted-foreground text-[11px] leading-relaxed">
						Mesh reduction stopped at{' '}
						{Math.round((1 - simplificationOutcome.achievedKeepRatio) * 100)}%
						of the requested{' '}
						{Math.round((1 - simplificationOutcome.requestedKeepRatio) * 100)}%
						— the deviation limit was reached first. Raise it to allow more
						reduction, at the cost of shape accuracy.
					</p>
				) : null}

				<MetricRow label="Texture size">
					<BeforeAfter
						before={formatFileSize(resolvedMetrics.textureBytes.initial)}
						after={formatFileSize(resolvedMetrics.textureBytes.current)}
					/>
				</MetricRow>
			</div>
		</motion.div>
	)
}
