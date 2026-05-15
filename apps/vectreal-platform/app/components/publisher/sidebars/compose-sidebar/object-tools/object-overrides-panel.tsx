import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { Switch } from '@shared/components/ui/switch'
import { useAtom } from 'jotai/react'
import { ChevronDown, ChevronRight, Sliders, Trash2 } from 'lucide-react'
import { memo, useCallback, useState } from 'react'

import { objectOverridesAtom } from '../../../../../lib/stores/scene-settings-store'

import type { ObjectOverride } from '@vctrl/core'

type AxisIndex = 0 | 1 | 2
type TransformField = 'position' | 'rotation' | 'scale'

const AXIS_LABELS: [string, string, string] = ['X', 'Y', 'Z']
const DEFAULT_TRANSFORM: NonNullable<ObjectOverride['transform']> = {
	position: [0, 0, 0],
	rotation: [0, 0, 0],
	scale: [1, 1, 1]
}

/**
 * ObjectOverridesPanel — CRUD panel for ObjectOverride entries.
 * Each entry targets a glTF node by nodeId and can adjust transform.
 */
const ObjectOverridesPanel = memo(() => {
	const [overrides, setOverrides] = useAtom(objectOverridesAtom)
	const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)

	const updateOverride = useCallback(
		(nodeId: string, patch: Partial<ObjectOverride>) => {
			setOverrides((prev) =>
				prev.map((o) => (o.nodeId === nodeId ? { ...o, ...patch } : o))
			)
		},
		[setOverrides]
	)

	const handleDelete = useCallback(
		(nodeId: string) => {
			setOverrides((prev) => prev.filter((o) => o.nodeId !== nodeId))
			setExpandedNodeId((prev) => (prev === nodeId ? null : prev))
		},
		[setOverrides]
	)

	const handleToggleEnabled = useCallback(
		(nodeId: string, enabled: boolean) => {
			updateOverride(nodeId, { enabled })
		},
		[updateOverride]
	)

	const handleTransformChange = useCallback(
		(nodeId: string, field: TransformField, axis: AxisIndex, value: string) => {
			const num = parseFloat(value)
			if (isNaN(num)) return
			setOverrides((prev) =>
				prev.map((o) => {
					if (o.nodeId !== nodeId) return o
					const currentTransform = o.transform ?? { ...DEFAULT_TRANSFORM }
					const currentField = currentTransform[field] ?? [
						...DEFAULT_TRANSFORM[field]!
					]
					const next: [number, number, number] = [
						...currentField
					] as [number, number, number]
					next[axis] = num
					return { ...o, transform: { ...currentTransform, [field]: next } }
				})
			)
		},
		[setOverrides]
	)

	if (overrides.length === 0) {
		return (
			<div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
				<Sliders className="h-8 w-8 opacity-40" />
				<p>No object overrides.</p>
				<p className="text-xs opacity-70">
					Go to the Object List and press + to create an override for a node.
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-2">
			{overrides.map((override) => {
				const isExpanded = expandedNodeId === override.nodeId
				const transform = override.transform ?? DEFAULT_TRANSFORM
				return (
					<div
						key={override.nodeId}
						className="rounded-xl border border-border/50 bg-background/30 overflow-hidden"
					>
						{/* Header */}
						<div className="flex items-center gap-2 px-3 py-2">
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 shrink-0"
								onClick={() =>
									setExpandedNodeId(isExpanded ? null : override.nodeId)
								}
								aria-label={isExpanded ? 'Collapse' : 'Expand'}
							>
								{isExpanded ? (
									<ChevronDown className="h-3.5 w-3.5" />
								) : (
									<ChevronRight className="h-3.5 w-3.5" />
								)}
							</Button>
							<span className="flex-1 truncate text-sm font-mono">
								{override.nodeId}
							</span>
							<Switch
								checked={override.enabled}
								onCheckedChange={(v) => handleToggleEnabled(override.nodeId, v)}
								aria-label="Enable override"
							/>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
								onClick={() => handleDelete(override.nodeId)}
								aria-label="Delete override"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</Button>
						</div>

						{/* Expanded form */}
						{isExpanded && (
							<div className="space-y-3 px-3 pb-3">
								<Separator />
								{(['position', 'rotation', 'scale'] as TransformField[]).map(
									(field) => (
										<div key={field} className="space-y-1.5">
											<Label className="text-xs capitalize text-muted-foreground">
												{field}
											</Label>
											<div className="grid grid-cols-3 gap-1.5">
												{AXIS_LABELS.map((axis, i) => (
													<div key={axis} className="space-y-0.5">
														<Label className="text-[10px] text-muted-foreground/70">
															{axis}
														</Label>
														<Input
															type="number"
															step={field === 'scale' ? 0.1 : 0.01}
															className="h-7 text-xs"
															value={
																transform[field]?.[i as AxisIndex] ??
																(field === 'scale' ? 1 : 0)
															}
															onChange={(e) =>
																handleTransformChange(
																	override.nodeId,
																	field,
																	i as AxisIndex,
																	e.target.value
																)
															}
														/>
													</div>
												))}
											</div>
										</div>
									)
								)}
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
})

ObjectOverridesPanel.displayName = 'ObjectOverridesPanel'

export default ObjectOverridesPanel
