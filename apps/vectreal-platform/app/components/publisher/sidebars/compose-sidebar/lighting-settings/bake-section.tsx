import { Button } from '@shared/components/ui/button'
import { Toggle } from '@shared/components/ui/toggle'
import { Loader2 } from 'lucide-react'

import { bakedAnything } from './use-bake-preview'
import { OCCLUSION_SKIP_REASONS } from '../../../../../lib/domain/scene/client/publish-export'
import { InlineNotice } from '../../../../layout-components'
import { PanelCaption } from '../../sidebar-section'

import type { BakePreview } from '../../../../../lib/stores/publisher-config-store'
import type { OcclusionBakeReport } from '@vctrl/core/occlusion-bake'

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
	report: OcclusionBakeReport | { failed: string }
}) {
	if ('failed' in report) {
		return (
			<div className="space-y-1 text-xs">
				<p className="flex justify-between gap-2 text-sm">
					<span>{label}</span>
					<span className="text-destructive">Failed</span>
				</p>
				<p className="text-muted-foreground">
					Publishing ships the model without it: {report.failed}
				</p>
			</div>
		)
	}
	return (
		<div className="space-y-1 text-xs">
			<p className="flex justify-between gap-2 text-sm">
				<span>{label}</span>
				<span className="text-muted-foreground">
					{report.baked.length > 0
						? plural(report.baked.length, 'material')
						: 'Nothing drawn'}
				</span>
			</p>
			{report.skipped.length > 0 && (
				<ul className="space-y-1">
					{report.skipped.map(({ material, reason }, index) => (
						<li key={`${material}-${index}`}>
							{material}
							<span className="text-muted-foreground">
								: {OCCLUSION_SKIP_REASONS[reason]}
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
					? 'Drawing the finish'
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
				<InlineNotice tone="error" role="alert">
					The studio finish failed: {preview.error}
				</InlineNotice>
			)}
		</>
	)
}
