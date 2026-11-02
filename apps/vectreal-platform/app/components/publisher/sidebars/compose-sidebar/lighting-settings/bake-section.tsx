import { Button } from '@shared/components/ui/button'
import { Toggle } from '@shared/components/ui/toggle'
import { Loader2 } from 'lucide-react'

import { bakedAnything, drawingLabel } from './use-bake-preview'
import {
	BAKE_RECOVERY_NOTES,
	BAKE_SKIP_REASONS,
	STUDIO_FINISH_FAILURES
} from '../../../../../lib/domain/scene/client/studio-finish-reasons'
import { InlineNotice } from '../../../../layout-components'
import { PanelCaption } from '../../sidebar-section'

import type { BakePreview } from '../../../../../lib/stores/publisher-config-store'
import type { BakePassOutcome } from '../../../../../workers/publish-export.worker.types'

interface BakeSectionProps {
	preview: BakePreview | null
	/** False until a model is loaded, and while an optimization pass runs. */
	canBake: boolean
	isOptimizing: boolean
	/** The preview shows an animated model in its rest pose. */
	isAnimated: boolean
	onBake: () => void
	onShownChange: (shown: boolean) => void
}

const plural = (count: number, noun: string) =>
	`${count} ${noun}${count === 1 ? '' : 's'}`

/** What one bake did: how many materials took it, and why the others did not. */
function BakeReport({
	label,
	report
}: {
	label: string
	report: BakePassOutcome
}) {
	if ('failed' in report) {
		return (
			<div className="space-y-1 text-xs wrap-anywhere">
				<p className="flex justify-between gap-2 text-sm">
					<span className="min-w-0">{label}</span>
					<span className="text-destructive shrink-0">Failed</span>
				</p>
				<p className="text-muted-foreground">
					{STUDIO_FINISH_FAILURES[report.failed].message} Publishing ships the
					model without it.
				</p>
			</div>
		)
	}
	return (
		<div className="space-y-1 text-xs wrap-anywhere">
			<p className="flex justify-between gap-2 text-sm">
				<span className="min-w-0">{label}</span>
				<span className="text-muted-foreground shrink-0">
					{report.baked.length > 0
						? plural(report.baked.length, 'material')
						: 'Nothing drawn'}
				</span>
			</p>
			{report.recovered && BAKE_RECOVERY_NOTES[report.recovered] && (
				<p className="text-muted-foreground">
					{BAKE_RECOVERY_NOTES[report.recovered]}
				</p>
			)}
			{report.skipped.length > 0 && (
				<ul className="space-y-1">
					{report.skipped.map(({ material, reason }, index) => (
						<li key={`${material}-${index}`}>
							{material}
							<span className="text-muted-foreground">
								: {BAKE_SKIP_REASONS[reason]}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

/**
 * The studio finish tried out before it ships: a preview of what publishing
 * will draw, shown on the model, a switch to compare it with the model as it
 * is, and what each part reached and what it could not.
 */
export function BakeSection({
	preview,
	canBake,
	isOptimizing,
	isAnimated,
	onBake,
	onShownChange
}: BakeSectionProps) {
	const isBaking = preview?.status === 'baking'
	const ready = preview?.status === 'ready' ? preview : null
	const reports = ready?.reports
	const hasBake = bakedAnything(ready)

	return (
		<>
			{/*
			  Not disabled while baking: a disabled button drops keyboard focus to
			  the page, far from the result it is waiting for.
			*/}
			<Button
				variant="outline"
				className="w-full"
				disabled={!canBake}
				aria-disabled={isBaking}
				onClick={isBaking ? undefined : onBake}
			>
				{isBaking && <Loader2 className="animate-spin" aria-hidden />}
				{isBaking
					? drawingLabel(preview.progress)
					: preview
						? 'Preview again'
						: 'Preview it on the model'}
			</Button>
			{!canBake && (
				<PanelCaption>
					{isOptimizing
						? 'Available once the optimization finishes.'
						: 'Load a model to preview the studio finish.'}
				</PanelCaption>
			)}

			<div role="status" className="space-y-3">
				{isBaking && (
					<PanelCaption>
						Drawing in the background. You can keep working; it finishes sooner
						while the view is still.
					</PanelCaption>
				)}
				{reports && (
					<>
						<p className="text-sm">
							{hasBake
								? `Drawn in ${((ready?.durationMs ?? 0) / 1000).toFixed(1)} s.`
								: 'No material on this model can take the studio finish.'}
						</p>
						{reports.occlusion && (
							<BakeReport label="Depth" report={reports.occlusion} />
						)}
						{reports.lights && (
							<BakeReport label="Studio lights" report={reports.lights} />
						)}
					</>
				)}
			</div>

			{hasBake && (
				<>
					<Toggle
						label="Show studio finish"
						checked={Boolean(ready?.shown)}
						onCheckedChange={onShownChange}
					/>
					{isAnimated && (
						<PanelCaption>
							Shown in the rest pose; the published model still plays its
							animation.
						</PanelCaption>
					)}
				</>
			)}

			{preview?.status === 'failed' && (
				<InlineNotice tone="error" role="alert" className="wrap-anywhere">
					{preview.failure &&
						STUDIO_FINISH_FAILURES[preview.failure.reason].message}
				</InlineNotice>
			)}
		</>
	)
}
