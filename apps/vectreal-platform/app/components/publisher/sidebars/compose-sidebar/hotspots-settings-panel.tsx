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
import { cn } from '@shared/utils'
import { useAtom, useSetAtom } from 'jotai/react'
import { Crosshair, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo } from 'react'

import {
	PAIRED_HOTSPOT_CAMERA_ID_PREFIX,
	resolveDefaultSceneCameraId
} from '../../../../lib/domain/scene/scene-camera'
import {
	addHotspot,
	relinkHotspot,
	removeHotspot,
	renameHotspot
} from '../../../../lib/domain/scene/scene-hotspot-camera-links'
import { assignSequenceIndex } from '../../../../lib/domain/scene/scene-hotspot-sequence'
import { isClickToPlaceActiveAtom } from '../../../../lib/stores/publisher-config-store'
import {
	activeHotspotIdAtom,
	cameraAtom,
	hotspotsAtom,
	selectedCameraIdAtom
} from '../../../../lib/stores/scene-settings-store'
import { ToggleButtonGroup } from '../../settings-components'
import {
	SidebarSection,
	SidebarSectionContent,
	SettingRow,
	SettingGroup
} from '../sidebar-section'

import type { ToggleButtonGroupOption } from '../../settings-components'
import type {
	CameraProps,
	HotspotDefinition,
	HotspotStylePreset
} from '@vctrl/core'

/**
 * `scene_hotspots.id` is a uuid primary key, so the hotspot id has to be a real
 * uuid. It was once minted as `hotspot-<timestamp>-<random>`, which Postgres
 * rejected on insert, and because that insert shares a transaction with the
 * settings and asset writes it failed the entire scene save rather than just
 * the hotspot.
 */
const mintHotspotIds = () => ({
	hotspotId: crypto.randomUUID(),
	cameraId: `${PAIRED_HOTSPOT_CAMERA_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
})

/**
 * Where the editor sits once retiring a hotspot's camera has taken the one it
 * was on.
 *
 * The viewer is pointed by `selectedCameraId`, so a selection naming a camera
 * that is gone aims it at nothing until the Camera tool is opened and runs its
 * own reconcile. Landing on the scene default is the answer that tool gives.
 */
const survivingSelectedCameraId = (
	cameras: CameraProps['cameras'],
	selectedCameraId: string
): string => {
	if (cameras?.some((entry) => entry.cameraId === selectedCameraId)) {
		return selectedCameraId
	}
	return resolveDefaultSceneCameraId(cameras) ?? selectedCameraId
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
	const setSelectedCameraId = useSetAtom(selectedCameraIdAtom)
	const [isClickToPlaceActive, setIsClickToPlaceActive] = useAtom(
		isClickToPlaceActiveAtom
	)

	const allCameras = camera.cameras ?? []

	/**
	 * Click-to-place is armed from this panel, so it is disarmed here too: when
	 * the hotspot it was aimed at is deselected, and when the panel goes away.
	 *
	 * The cleanup is the load-bearing half. Switching compose tools unmounts the
	 * panel without deselecting anything, and the atom outlives it, so the
	 * canvas stayed armed under a tool that shows no placement affordance at all.
	 */
	useEffect(() => {
		if (!selectedId) {
			setIsClickToPlaceActive(false)
		}
	}, [selectedId, setIsClickToPlaceActive])

	useEffect(
		() => () => {
			setIsClickToPlaceActive(false)
		},
		[setIsClickToPlaceActive]
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
		const ids = mintHotspotIds()
		const next = addHotspot({ camera, hotspots }, ids)

		setHotspots(next.hotspots)
		setCamera(next.camera)
		setSelectedId(ids.hotspotId)
	}, [camera, hotspots, setCamera, setHotspots, setSelectedId])

	const handleDelete = useCallback(
		(id: string) => {
			const next = removeHotspot({ camera, hotspots }, id)

			setHotspots(next.hotspots)
			setCamera(next.camera)
			setSelectedCameraId((prev) =>
				survivingSelectedCameraId(next.camera.cameras, prev)
			)
			setSelectedId((prev) => (prev === id ? null : prev))
		},
		[
			camera,
			hotspots,
			setCamera,
			setHotspots,
			setSelectedCameraId,
			setSelectedId
		]
	)

	const handleRename = useCallback(
		(id: string, name: string) => {
			const next = renameHotspot({ camera, hotspots }, id, name)

			setHotspots(next.hotspots)
			setCamera(next.camera)
		},
		[camera, hotspots, setCamera, setHotspots]
	)

	const handleRelink = useCallback(
		(id: string, linkedCameraId: string | undefined) => {
			const next = relinkHotspot({ camera, hotspots }, id, linkedCameraId)

			setHotspots(next.hotspots)
			setCamera(next.camera)
			setSelectedCameraId((prev) =>
				survivingSelectedCameraId(next.camera.cameras, prev)
			)
		},
		[camera, hotspots, setCamera, setHotspots, setSelectedCameraId]
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

	/**
	 * The server rejects duplicate sequence indices outright, with a message
	 * naming the number and neither hotspot. Typing an index another hotspot
	 * already holds swaps the two rather than creating that collision, which
	 * is also what someone reordering a sequence expects.
	 */
	const handleSequenceChange = useCallback(
		(raw: string) => {
			if (!selectedHotspot) return

			if (raw === '') {
				setHotspots((prev) =>
					assignSequenceIndex(prev, selectedHotspot.id, undefined)
				)
				return
			}

			const parsed = parseInt(raw, 10)
			if (isNaN(parsed) || parsed < 0) return

			setHotspots((prev) =>
				assignSequenceIndex(prev, selectedHotspot.id, parsed)
			)
		},
		[selectedHotspot, setHotspots]
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
									className={cn(
										'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors',
										selectedId === hotspot.id
											? 'bg-orange/80'
											: 'hover:bg-orange/40'
									)}
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
									handleRename(selectedHotspot.id, e.target.value)
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
									handleRelink(selectedHotspot.id, v === 'none' ? undefined : v)
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
								onChange={(e) => handleSequenceChange(e.target.value)}
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
