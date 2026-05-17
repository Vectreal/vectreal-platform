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
import { Switch } from '@shared/components/ui/switch'
import { useAtom } from 'jotai/react'
import { Crosshair, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo } from 'react'

import { isClickToPlaceActiveAtom } from '../../../../../lib/stores/publisher-config-store'
import {
	activeHotspotIdAtom,
	cameraAtom,
	hotspotsAtom
} from '../../../../../lib/stores/scene-settings-store'
import { ToggleButtonGroup } from '../../../settings-components'
import {
	SidebarSection,
	SidebarSectionContent,
	SettingRow,
	SettingGroup
} from '../../sidebar-section'

import type { ToggleButtonGroupOption } from '../../../settings-components'
import type { HotspotDefinition, HotspotStylePreset } from '@vctrl/core'

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
		occlusionEnabled: true,
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
	const [selectedId, setSelectedId] = useAtom(activeHotspotIdAtom)
	const [isClickToPlaceActive, setIsClickToPlaceActive] = useAtom(
		isClickToPlaceActiveAtom
	)

	const allCameras = camera.cameras ?? []

	// Auto-disable click-to-place when deselecting a hotspot
	useEffect(() => {
		if (!selectedId) {
			setIsClickToPlaceActive(false)
		}
	}, [selectedId, setIsClickToPlaceActive])

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
		<div className="space-y-8">
			{/* Hotspots List */}
			<SidebarSection
				title="Hotspots"
				tooltip="Hotspots mark interactive points in 3D space. They can trigger camera transitions or display custom overlays."
			>
				<SidebarSectionContent>
					{hotspots.length === 0 ? (
						<div className="py-6 text-center">
							<p className="text-muted-foreground text-sm">No hotspots yet.</p>
							<p className="text-muted-foreground mt-1 mb-4 text-xs">
								Add one to create a point of interest for viewers.
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={handleAdd}
								className="gap-1.5"
							>
								<Plus className="h-3.5 w-3.5" />
								Add Hotspot
							</Button>
						</div>
					) : (
						<div className="space-y-1.5">
							{hotspots.map((hotspot) => (
								<div
									key={hotspot.id}
									className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors ${
										selectedId === hotspot.id
											? 'bg-accent/80'
											: 'hover:bg-accent/40'
									}`}
									onClick={() =>
										setSelectedId((prev) =>
											prev === hotspot.id ? null : hotspot.id
										)
									}
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm leading-tight font-medium">
											{hotspot.name || 'Unnamed Hotspot'}
										</p>
										<p className="text-muted-foreground font-mono text-xs">
											{hotspot.worldPosition
												.map((v) => v.toFixed(2))
												.join(', ')}
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
							<Button
								variant="outline"
								size="sm"
								className="mt-3 w-full gap-1.5"
								onClick={handleAdd}
								title="Add hotspot"
							>
								<Plus className="h-3.5 w-3.5" />
								Add Hotspot
							</Button>
						</div>
					)}
				</SidebarSectionContent>
			</SidebarSection>

			{/* Selected Hotspot Editor */}
			{selectedHotspot && (
				<SidebarSection title={`Edit: ${selectedHotspot.name || 'Unnamed'}`}>
					<SidebarSectionContent>
						{/* Click to Place Info */}
						{isClickToPlaceActive && (
							<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
								<p className="text-xs text-amber-700 dark:text-amber-400">
									Click anywhere on the model to move this hotspot there.
								</p>
							</div>
						)}

						{/* Click to Place Button */}
						<Button
							variant={isClickToPlaceActive ? 'default' : 'outline'}
							size="sm"
							className="w-full gap-1.5"
							onClick={() => setIsClickToPlaceActive((v) => !v)}
							title="Click on the model to move this hotspot"
						>
							<Crosshair className="h-3.5 w-3.5" />
							{isClickToPlaceActive ? 'Placing...' : 'Click to Place'}
						</Button>

						{/* Name */}
						<SettingRow label="Name">
							<Input
								value={selectedHotspot.name}
								onChange={(e) =>
									updateHotspot(selectedHotspot.id, { name: e.target.value })
								}
								placeholder="Hotspot name"
								className="text-sm"
							/>
						</SettingRow>

						{/* World Position */}
						<SettingGroup
							label="World Position"
							description="3D world-space coordinates (X, Y, Z)"
						>
							<div className="grid grid-cols-3 gap-1.5">
								{(['X', 'Y', 'Z'] as const).map((axis, idx) => (
									<div key={axis} className="space-y-1">
										<Label className="text-muted-foreground text-xs font-medium">
											{axis}
										</Label>
										<Input
											type="number"
											step="0.1"
											value={selectedHotspot.worldPosition[idx]}
											onChange={(e) =>
												handlePositionChange(idx as 0 | 1 | 2, e.target.value)
											}
											className="h-8 font-mono text-xs"
										/>
									</div>
								))}
							</div>
						</SettingGroup>

						{/* Style Preset */}
						<SettingGroup label="Style">
							<ToggleButtonGroup
								options={STYLE_PRESET_OPTIONS}
								value={selectedHotspot.stylePreset}
								onChange={(v) =>
									updateHotspot(selectedHotspot.id, { stylePreset: v })
								}
							/>
						</SettingGroup>

						{selectedHotspot.stylePreset !== 'dot' && (
							<SettingRow label="Asset URL">
								<Input
									value={selectedHotspot.payloadUrl ?? ''}
									onChange={(e) =>
										updateHotspot(selectedHotspot.id, {
											payloadUrl: e.target.value || undefined
										})
									}
									placeholder="https://…"
									className="text-sm"
								/>
							</SettingRow>
						)}

						{/* Linked Camera */}
						<SettingGroup
							label="Linked Camera"
							description="Viewers transition to this camera when clicking the hotspot"
						>
										<Select
								value={selectedHotspot.linkedCameraId ?? 'none'}
								onValueChange={(v) =>
									updateHotspot(selectedHotspot.id, {
										linkedCameraId: v === 'none' ? undefined : v
									})
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{allCameras.map((c) => (
										<SelectItem key={c.cameraId} value={c.cameraId}>
											{c.name || c.cameraId}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SettingGroup>

						{/* Sequence Index */}
						<SettingRow label="Sequence Order">
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
								className="h-8 font-mono text-sm"
							/>
						</SettingRow>

						{/* Toggles */}
						<div className="space-y-3 border-t pt-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Label className="text-sm font-medium">
										{selectedHotspot.visible ? (
											<Eye className="mr-1 inline h-4 w-4" />
										) : (
											<EyeOff className="mr-1 inline h-4 w-4" />
										)}
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
								<Label className="text-sm font-medium">Editor Only</Label>
								<Switch
									checked={selectedHotspot.internalOnly}
									onCheckedChange={(v) =>
										updateHotspot(selectedHotspot.id, { internalOnly: v })
									}
								/>
							</div>
							<div className="flex items-center justify-between">
								<Label className="text-sm font-medium">Depth Occlusion</Label>
								<Switch
									checked={selectedHotspot.occlusionEnabled ?? true}
									onCheckedChange={(v) =>
										updateHotspot(selectedHotspot.id, { occlusionEnabled: v })
									}
								/>
							</div>
						</div>
					</SidebarSectionContent>
				</SidebarSection>
			)}
		</div>
	)
})

HotspotsSettingsPanel.displayName = 'HotspotsSettingsPanel'

export default HotspotsSettingsPanel
