import { Button } from '@shared/components/ui/button'
import { Toggle } from '@shared/components/ui/toggle'
import { ChevronRight, Loader2 } from 'lucide-react'
import { useId } from 'react'

import { bakedAnything, drawingLabel } from './use-bake-preview'
import { useDrillDownNavigation } from '../../drill-down'
import { PanelCaption } from '../../sidebar-section'

import type { BakePreview } from '../../../../../lib/stores/publisher-config-store'

export type FinishStatus =
	'off' | 'on' | 'drawing' | 'applied' | 'compare' | 'nothing' | 'failed'

/** Where the studio finish stands, from what the lighting asks and the preview. */
export function finishStatus(
	requested: boolean,
	preview: BakePreview | null
): FinishStatus {
	if (!requested) return 'off'
	if (!preview) return 'on'
	if (preview.status === 'baking') return 'drawing'
	if (preview.status === 'failed') return 'failed'
	if (!bakedAnything(preview)) return 'nothing'
	return preview.shown ? 'applied' : 'compare'
}

export const FINISH_STATUS_LABELS = {
	off: 'Off',
	on: 'Added at publish',
	drawing: 'Drawing',
	applied: 'Shown',
	compare: 'Hidden',
	nothing: 'Nothing to finish',
	failed: 'Failed'
} as const satisfies Record<FinishStatus, string>

interface StudioFinishCardProps {
	status: FinishStatus
	/** How far the preview has drawn, while it draws. */
	progress?: BakePreview['progress']
	/** Why nothing took the finish, shown when there is nothing to finish. */
	nothingCaption?: string
	/** False until a model is loaded, and while an optimization pass runs. */
	canPreview: boolean
	isOptimizing: boolean
	onAdd: () => void
	onPreview: () => void
	onShownChange: (shown: boolean) => void
}

/**
 * The studio finish from the Lighting tool's root: what it is, where it
 * stands, and the one next step, with its settings a level down.
 */
export function StudioFinishCard({
	status,
	progress,
	nothingCaption,
	canPreview,
	isOptimizing,
	onAdd,
	onPreview,
	onShownChange
}: StudioFinishCardProps) {
	const { push } = useDrillDownNavigation()
	const titleId = useId()

	return (
		<section
			aria-labelledby={titleId}
			className="shell-nested space-y-3 rounded-xl p-3"
		>
			<div className="flex items-center gap-2 text-sm font-medium">
				<h3 id={titleId} className="flex-1 text-sm font-medium">
					Studio finish
				</h3>
				<span className="text-muted-foreground text-xs font-normal">
					{FINISH_STATUS_LABELS[status]}
				</span>
			</div>
			<PanelCaption>
				Soft shadows and depth, drawn into the model once, so every view shows
				them at no cost.
			</PanelCaption>

			{status === 'nothing' && nothingCaption && (
				<PanelCaption>{nothingCaption}</PanelCaption>
			)}
			{status === 'off' && (
				<Button variant="brand" className="w-full" onClick={onAdd}>
					Add studio finish
				</Button>
			)}
			{(status === 'on' || status === 'failed') && (
				<Button
					variant="outline"
					className="w-full"
					disabled={!canPreview}
					onClick={onPreview}
				>
					{status === 'failed' ? 'Try again' : 'Preview it on the model'}
				</Button>
			)}
			{(status === 'on' || status === 'failed') && !canPreview && (
				<PanelCaption>
					{isOptimizing
						? 'Available once the optimization finishes.'
						: 'Load a model to preview the studio finish.'}
				</PanelCaption>
			)}
			{status === 'drawing' && (
				// Not disabled: a disabled button drops focus to the page.
				<Button variant="outline" className="w-full" aria-disabled>
					<Loader2 className="animate-spin" aria-hidden />
					{drawingLabel(progress)}
				</Button>
			)}
			{(status === 'applied' || status === 'compare') && (
				<Toggle
					label="Show studio finish"
					checked={status === 'applied'}
					onCheckedChange={onShownChange}
				/>
			)}

			<button
				type="button"
				data-drill-down-trigger="finish"
				onClick={() => push('finish', 'finish')}
				className="shell-focus text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-xs"
			>
				Settings and report
				<ChevronRight aria-hidden className="size-4" />
			</button>
		</section>
	)
}
