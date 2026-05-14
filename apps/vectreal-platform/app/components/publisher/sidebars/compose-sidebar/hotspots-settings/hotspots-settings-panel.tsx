import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Separator } from '@shared/components/ui/separator'
import { Switch } from '@shared/components/ui/switch'
import { useAtom } from 'jotai/react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'

import {
	cameraAtom,
	hotspotsAtom
} from '../../../../../lib/stores/scene-settings-store'
import { InfoTooltip } from '../../../../info-tooltip'
import { ToggleButtonGroup } from '../../../settings-components'

import type { ToggleButtonGroupOption } from '../../../settings-components'
import type {
	HotspotDefinition,
	HotspotStylePreset
} from '@vctrl/core'

function createHotspotId(): string {
	return `hotspot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createDefaultHotspot(): HotspotDefinition {
	return {
		id: createHotspotId(),
		name: 'New Hotspot',
		worldPosition: [0, 0, 0],
		visible: true,
		internalOnly: false,
		stylePreset: 'dot'
	}
}

const STYLE_PRESET_OPTIONS: ToggleButtonGroupOption<HotspotStylePreset>[] = [
	{ value: 'dot', label: 'Dot' },
	{ value: 'image', label: 'Image' },
	{ value: 'svg', label: 'SVG' }
]

const HotspotsSettingsPanel = memo(() => {
	const [hotspots, setHotspots] = useAtom(hotspotsAtom)
	const [camera, setCamera] = useAtom(cameraAtom)
	const [selectedId, setSelectedId] = useState<string | null>(null)

	const hotspotCameras = useMemo(
		() => (camera.cameras ?? []).filter((c) => c.kind === 'hotspot'),
		[camera.cameras]
	)

	const selectedHotspot = useMemo(
		() => hotspots.find((h) => h.id === selectedId) ?? null,
		[hotspots, selectedId]
	)

	const updateHotspot = useCallback(
		(id: string, patch: Partial<HotspotDefinition>) => {
			setHotspots((prev) =>
				prev.map((h) => (h.id === id ? { ...h, ...patch } : h))
			)
		},
		[setHotspots]
	)

	const handleAdd = useCallback(() => {
		const pairedCameraId = `hotspot-camera-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
		const next: HotspotDefinition = {
			...createDefaultHotspot(),
			linkedCameraId: pairedCameraId
		}
		setHotspots((prev) => [...prev, next])
		setCamera((prev) => ({
			...prev,
			cameras: [
				...(prev.cameras ?? []),
				{
					cameraId: pairedCameraId,
					name: `${next.name} Camera`,
					kind: 'hotspot' as const,
					fov: 60
				}
			]
		}))
		setSelectedId(next.id)
	}, [setCamera, setHotspots])

	const handleDelete = useCallback(
		(id: string) => {
			const hotspot = hotspots.find((h) => h.id === id)
			setHotspots((prev) => prev.filter((h) => h.id !== id))
			if (hotspot?.linkedCameraId) {
				setCamera((prev) => ({
					...prev,
					cameras: (prev.cameras ?? []).filter(
						(c) => c.cameraId !== hotspot.linkedCameraId
					)
				}))
			}
			setSelectedId((prev) => (prev === id ? null : prev))
		},
		[hotspots, setCamera, setHotspots]
	)

	const handlePositionChange = useCallback(
		(axis: 0 | 1 | 2, raw: string) => {
			if (!selectedHotspot) return
			const value = parseFloat(raw)
			if (isNaN(value)) return
			const next: [number, number, number] = [
				...selectedHotspot.worldPosition
			] as [number, number, number]
			next[axis] = value
			updateHotspot(selectedHotspot.id, { worldPosition: next })
		},
		[selectedHotspot, updateHotspot]
	)

	return (
		<div className="space-y-6">
			{/* Hotspot List */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
							Hotspots
						</p>
						<InfoTooltip content="Hotspots mark interactive points in 3D space. They can trigger camera transitions or display custom overlays." />
					</div>
					<Button variant="outline" size="icon" onClick={handleAdd} title="Add hotspot">
						<Plus />
					</Button>
				</div>
				<Separator />

				{hotspots.length === 0 ? (
					<div className="py-4 text-center">
						<p className="text-muted-foreground text-xs">
							No hotspots yet.
						</p>
						<p className="text-muted-foreground mb-3 text-xs">
							Add one to create a point of interest for viewers.
						</p>
						<Button variant="outline" size="sm" onClick={handleAdd} className="gap-1.5">
							<Plus className="h-3.5 w-3.5" />
							Add Hotspot
						</Button>
					</div>
				) : (
					<div className="space-y-1">
						{hotspots.map((hotspot) => (
							<div
								key={hotspot.id}
								className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
									selectedId === hotspot.id
										? 'bg-accent'
										: 'hover:bg-accent/50'
								}`}
								onClick={() =>
									setSelectedId((prev) =>
										prev === hotspot.id ? null : hotspot.id
									)
								}
							>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm leading-tight">
										{hotspot.name || 'Unnamed Hotspot'}
									</p>
									<p className="text-muted-foreground font-mono text-xs">
										{hotspot.worldPosition.map((v) => v.toFixed(2)).join(', ')}
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-1.5">
									{hotspot.internalOnly && (
										<Badge variant="secondary" className="text-xs">
											Editor only
										</Badge>
									)}
									{!hotspot.visible && (
										<EyeOff className="text-muted-foreground h-3.5 w-3.5" />
									)}
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={(e) => {
											e.stopPropagation()
											handleDelete(hotspot.id)
										}}
										title="Delete hotspot"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Selected Hotspot Editor */}
			{selectedHotspot && (
				<div className="space-y-4">
					<div className="flex items-center gap-2">
						<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
							Edit: {selectedHotspot.name || 'Unnamed'}
						</p>
					</div>
					<Separator />

					{/* Name */}
					<div className="space-y-1">
						<Label className="text-muted-foreground text-xs">Name</Label>
						<Input
							value={selectedHotspot.name}
							onChange={(e) =>
								updateHotspot(selectedHotspot.id, { name: e.target.value })
							}
							placeholder="Hotspot name"
						/>
					</div>

					{/* World Position */}
					<div className="space-y-1.5">
						<div className="flex items-center gap-1.5">
							<Label className="text-muted-foreground text-xs">
								World Position
							</Label>
							<InfoTooltip content="3D world-space coordinates (X, Y, Z). Viewer pick coming in a future update." />
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{(['X', 'Y', 'Z'] as const).map((axis, idx) => (
								<div key={axis} className="space-y-0.5">
									<Label className="text-muted-foreground text-xs">
										{axis}
									</Label>
									<Input
										type="number"
										step="0.1"
										value={selectedHotspot.worldPosition[idx]}
										onChange={(e) =>
											handlePositionChange(idx as 0 | 1 | 2, e.target.value)
										}
										className="h-7 font-mono text-xs"
									/>
								</div>
							))}
						</div>
					</div>

					{/* Style Preset */}
					<div className="space-y-1.5">
						<Label className="text-muted-foreground text-xs">Style</Label>
						<ToggleButtonGroup
							options={STYLE_PRESET_OPTIONS}
							value={selectedHotspot.stylePreset}
							onChange={(v) =>
								updateHotspot(selectedHotspot.id, { stylePreset: v })
							}
						/>
						{selectedHotspot.stylePreset !== 'dot' && (
							<div className="space-y-1">
								<Label className="text-muted-foreground text-xs">
									Asset URL
								</Label>
								<Input
									value={selectedHotspot.payloadUrl ?? ''}
									onChange={(e) =>
										updateHotspot(selectedHotspot.id, {
											payloadUrl: e.target.value || undefined
										})
									}
									placeholder="https://…"
									className="text-xs"
								/>
							</div>
						)}
					</div>

					{/* Linked Camera */}
					<div className="space-y-1.5">
						<div className="flex items-center gap-1.5">
							<Label className="text-muted-foreground text-xs">
								Linked Camera
							</Label>
							<InfoTooltip content="Viewers transition to this camera when clicking the hotspot. Created automatically — frame it using the Camera tool." />
						</div>
						{hotspotCameras.length > 0 ? (
							<Select
								value={selectedHotspot.linkedCameraId ?? ''}
								onValueChange={(v) =>
									updateHotspot(selectedHotspot.id, {
										linkedCameraId: v || undefined
									})
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="">None</SelectItem>
									{hotspotCameras.map((c) => (
										<SelectItem key={c.cameraId} value={c.cameraId}>
											{c.name || c.cameraId}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<p className="text-muted-foreground text-xs">
								Add a hotspot to automatically create a linked camera.
							</p>
						)}
					</div>

					{/* Sequence Index */}
					<div className="space-y-1.5">
						<div className="flex items-center gap-1.5">
							<Label className="text-muted-foreground text-xs">
								Sequence Order
							</Label>
							<InfoTooltip content="Set a 0-based index to include this hotspot in the navigation sequence. Leave empty to exclude." />
						</div>
						<Input
							type="number"
							min={0}
							step={1}
							placeholder="Not in sequence"
							value={
								selectedHotspot.sequenceIndex !== undefined
									? selectedHotspot.sequenceIndex
									: ''
							}
							onChange={(e) => {
								const raw = e.target.value
								if (raw === '') {
									updateHotspot(selectedHotspot.id, {
										sequenceIndex: undefined
									})
									return
								}
								const parsed = parseInt(raw, 10)
								if (!isNaN(parsed) && parsed >= 0) {
									updateHotspot(selectedHotspot.id, { sequenceIndex: parsed })
								}
							}}
							className="h-7 font-mono text-xs"
						/>
					</div>

					{/* Toggles */}
					<div className="space-y-2.5">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<Label className="text-sm">
									{selectedHotspot.visible ? (
										<Eye className="inline h-3.5 w-3.5" />
									) : (
										<EyeOff className="inline h-3.5 w-3.5" />
									)}{' '}
									Visible
								</Label>
							</div>
							<Switch
								checked={selectedHotspot.visible}
								onCheckedChange={(v) =>
									updateHotspot(selectedHotspot.id, { visible: v })
								}
							/>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<Label className="text-sm">Editor Only</Label>
								<InfoTooltip content="When enabled, this hotspot is visible in the editor but excluded from the published embed." />
							</div>
							<Switch
								checked={selectedHotspot.internalOnly}
								onCheckedChange={(v) =>
									updateHotspot(selectedHotspot.id, { internalOnly: v })
								}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	)
})

HotspotsSettingsPanel.displayName = 'HotspotsSettingsPanel'

export default HotspotsSettingsPanel
