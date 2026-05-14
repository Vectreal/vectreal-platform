import { Button } from '@shared/components/ui/button'
import {
	Collapsible,
	CollapsibleContent
} from '@shared/components/ui/collapsible'
import { Input } from '@shared/components/ui/input'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Separator } from '@shared/components/ui/separator'
import { useAtom, useAtomValue } from 'jotai/react'
import { Camera, Pin, Plus, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import {
	defaultCameraOptions,
	defaultControlsOptions,
	type FieldConfig
} from './constants'
import {
	cameraAtom,
	hotspotsAtom,
	selectedCameraIdAtom
} from '../../../../../lib/stores/scene-settings-store'
import { InfoTooltip } from '../../../../info-tooltip'
import { usePublisherViewerCapture } from '../../../publisher-viewer-capture-context'
import {
	EnhancedSettingSlider,
	ToggleButtonGroup
} from '../../../settings-components'
import { CollapsibleSectionTrigger } from '../../accordion-components'

import type { ToggleButtonGroupOption } from '../../../settings-components'
import type {
	CameraProps,
	CameraTransitionConfig,
	CameraTransitionEasing,
	CameraTransitionType,
	DefaultCameraStrategy
} from '@vctrl/core'
import type { SceneCameraSnapshot } from '@vctrl/viewer'

const ControlField = memo(
	({
		config,
		value,
		onUpdate,
		enabled
	}: {
		config: FieldConfig
		value: number
		onUpdate: (key: string, value: number) => void
		enabled?: boolean
	}) => (
		<EnhancedSettingSlider
			enabled={enabled}
			id={config.key}
			sliderProps={{
				min: config.min,
				max: config.max,
				step: config.step,
				value:
					value ??
					defaultControlsOptions[
						config.key as keyof typeof defaultControlsOptions
					],
				onChange: (newValue) => onUpdate(config.key, newValue)
			}}
			label={config.label}
			tooltip={config.tooltip}
			labelProps={{
				low: `${config.min}${config.unit || ''} - ${config.label.includes('Speed') ? 'Slow' : 'Min'}`,
				high: `${config.max}${config.unit || ''} - ${config.label.includes('Speed') ? 'Fast' : 'Max'}`
			}}
			formatValue={config.formatValue}
			valueMapping={config.valueMapping}
			allowDirectInput={true}
		/>
	)
)
ControlField.displayName = 'ControlField'

function createId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

type CameraEntry = NonNullable<CameraProps['cameras']>[number]

function applySnapshotToCamera(
	cameraEntry: CameraEntry,
	snapshot: null | SceneCameraSnapshot
): CameraEntry {
	if (!snapshot) {
		return cameraEntry
	}

	return {
		...cameraEntry,
		position: snapshot.position,
		rotation: snapshot.rotation,
		target: snapshot.target,
		fov: snapshot.fov
	}
}

const TRANSITION_TYPE_OPTIONS: ToggleButtonGroupOption<CameraTransitionType>[] =
	[
		{ value: 'none', label: 'Instant' },
		{ value: 'linear', label: 'Linear' },
		{ value: 'object_avoidance', label: 'Smart' }
	]

const TRANSITION_EASING_OPTIONS: ToggleButtonGroupOption<CameraTransitionEasing>[] =
	[
		{ value: 'linear', label: 'Linear' },
		{ value: 'ease_in', label: 'Ease In' },
		{ value: 'ease_out', label: 'Ease Out' },
		{ value: 'ease_in_out', label: 'Smooth' }
	]

const DEFAULT_OBJECT_AVOIDANCE = {
	clearance: 2,
	arcHeight: 2,
	samples: 24,
	tension: 0.5
}

function getNormalizedTransition(
	transition?: CameraTransitionConfig
): CameraTransitionConfig {
	if (!transition) {
		return {
			type: 'linear',
			duration: 1000,
			easing: 'ease_in_out'
		}
	}

	if (transition.type === 'none') {
		return { type: 'none' }
	}

	if (transition.type === 'object_avoidance') {
		return {
			type: 'object_avoidance',
			duration: transition.duration ?? 1000,
			easing: transition.easing ?? 'ease_in_out',
			objectAvoidance: {
				clearance:
					transition.objectAvoidance?.clearance ??
					DEFAULT_OBJECT_AVOIDANCE.clearance,
				arcHeight:
					transition.objectAvoidance?.arcHeight ??
					DEFAULT_OBJECT_AVOIDANCE.arcHeight,
				samples:
					transition.objectAvoidance?.samples ??
					DEFAULT_OBJECT_AVOIDANCE.samples,
				tension:
					transition.objectAvoidance?.tension ??
					DEFAULT_OBJECT_AVOIDANCE.tension
			}
		}
	}

	return {
		type: 'linear',
		duration: transition.duration ?? 1000,
		easing: transition.easing ?? 'ease_in_out'
	}
}

function resolveDefaultCameraId(
	cameras: CameraEntry[],
	strategy?: DefaultCameraStrategy,
	manualId?: string
): string {
	if (!cameras.length) return ''
	const sceneCameras = cameras.filter((c) => !c.kind || c.kind === 'scene')
	const pool = sceneCameras.length > 0 ? sceneCameras : cameras

	if (strategy === 'manual') {
		const found = cameras.find((c) => c.cameraId === manualId)
		return found?.cameraId ?? pool[0]?.cameraId ?? ''
	}
	if (strategy === 'last') {
		return pool[pool.length - 1]?.cameraId ?? ''
	}
	// 'first' (default when strategy is undefined)
	return pool[0]?.cameraId ?? ''
}

function normalizeCameraPayload(camera: CameraProps): CameraProps {
	const sourceCameras =
		camera.cameras && camera.cameras.length > 0
			? camera.cameras
			: (defaultCameraOptions.cameras ?? [])

	const seenCameraIds = new Set<string>()
	const normalizedCameras = sourceCameras.map((entry, index) => {
		const rawCameraId = entry.cameraId || `camera-${index + 1}`
		const cameraId = seenCameraIds.has(rawCameraId)
			? `${rawCameraId}-${index + 1}`
			: rawCameraId
		seenCameraIds.add(cameraId)

		return {
			...entry,
			cameraId,
			name: typeof entry.name === 'string' ? entry.name : `Camera ${index + 1}`
		}
	})

	const fallbackCamera = normalizedCameras[0]
	if (!fallbackCamera) {
		return defaultCameraOptions
	}

	const activeCameraId =
		(camera.activeCameraId &&
		normalizedCameras.some((entry) => entry.cameraId === camera.activeCameraId)
			? camera.activeCameraId
			: undefined) ??
		normalizedCameras.find((entry) => entry.initial)?.cameraId ??
		fallbackCamera.cameraId

	const effectiveDefaultId = resolveDefaultCameraId(
		normalizedCameras,
		camera.defaultCameraStrategy,
		camera.defaultCameraId
	)

	return {
		...camera,
		activeCameraId,
		cameras: normalizedCameras.map((entry) => ({
			...entry,
			initial: entry.cameraId === effectiveDefaultId
		}))
	}
}

const FOV_PRESETS: ToggleButtonGroupOption<number>[] = [
	{ value: 90, label: 'Wide', subLabel: '90°' },
	{ value: 60, label: 'Standard', subLabel: '60°' },
	{ value: 35, label: 'Telephoto', subLabel: '35°' }
]

const DURATION_PRESETS: ToggleButtonGroupOption<number>[] = [
	{ value: 0, label: 'Instant', subLabel: '0ms' },
	{ value: 500, label: 'Quick', subLabel: '500ms' },
	{ value: 2000, label: 'Slow', subLabel: '2000ms' }
]

function getClosestPreset<T extends { value: number }>(
	presets: T[],
	current: number
): number {
	let closest = presets[0].value
	let minDiff = Math.abs(current - presets[0].value)
	for (const preset of presets) {
		const diff = Math.abs(current - preset.value)
		if (diff < minDiff) {
			minDiff = diff
			closest = preset.value
		}
	}
	return closest
}

const getClosestFovPreset = (current: number) =>
	getClosestPreset(FOV_PRESETS, current)
const getClosestDurationPreset = (current: number) =>
	getClosestPreset(DURATION_PRESETS, current)

const DEFAULT_STRATEGY_OPTIONS: ToggleButtonGroupOption<DefaultCameraStrategy>[] =
	[
		{ value: 'first', label: 'First' },
		{ value: 'last', label: 'Last' },
		{ value: 'manual', label: 'Manual' }
	]

const CameraControlsSettingsPanel = memo(() => {
	const [camera, setCamera] = useAtom(cameraAtom)
	const [selectedCameraId, setSelectedCameraId] = useAtom(selectedCameraIdAtom)
	const hotspots = useAtomValue(hotspotsAtom)
	const [cameraNameDraft, setCameraNameDraft] = useState('')
	const [transitionAdvancedOpen, setTransitionAdvancedOpen] = useState(false)
	const { requestSceneCameraSnapshot } = usePublisherViewerCapture()

	const hotspotNameByCameraId = useMemo(
		() =>
			Object.fromEntries(
				hotspots
					.filter((h) => h.linkedCameraId)
					.map((h) => [h.linkedCameraId, h.name])
			),
		[hotspots]
	)

	const normalizedCamera = useMemo(
		() => normalizeCameraPayload(camera),
		[camera]
	)
	const selectedCamera = useMemo(
		() =>
			normalizedCamera.cameras?.find(
				(cameraEntry) =>
					cameraEntry.cameraId === normalizedCamera.activeCameraId
			) ??
			normalizedCamera.cameras?.find(
				(cameraEntry) => cameraEntry.cameraId === selectedCameraId
			) ??
			normalizedCamera.cameras?.[0],
		[normalizedCamera, selectedCameraId]
	)
	const selectedTransition = useMemo(
		() => getNormalizedTransition(normalizedCamera.sceneTransition),
		[normalizedCamera.sceneTransition]
	)

	const sceneCameras = useMemo(
		() =>
			(normalizedCamera.cameras ?? []).filter(
				(c) => !c.kind || c.kind === 'scene'
			),
		[normalizedCamera.cameras]
	)

	const hotspotCameras = useMemo(
		() => (normalizedCamera.cameras ?? []).filter((c) => c.kind === 'hotspot'),
		[normalizedCamera.cameras]
	)

	const resolvedDefaultCameraId = useMemo(
		() =>
			resolveDefaultCameraId(
				normalizedCamera.cameras ?? [],
				normalizedCamera.defaultCameraStrategy,
				normalizedCamera.defaultCameraId
			),
		[
			normalizedCamera.cameras,
			normalizedCamera.defaultCameraStrategy,
			normalizedCamera.defaultCameraId
		]
	)

	useEffect(() => {
		const nextSelectedId =
			selectedCamera?.cameraId ??
			normalizedCamera.activeCameraId ??
			normalizedCamera.cameras?.[0]?.cameraId

		if (nextSelectedId && selectedCameraId !== nextSelectedId) {
			setSelectedCameraId(nextSelectedId)
		}
	}, [normalizedCamera, selectedCamera, selectedCameraId, setSelectedCameraId])

	useEffect(() => {
		setCameraNameDraft(selectedCamera?.name ?? '')
	}, [selectedCamera?.cameraId, selectedCamera?.name])

	const updateSelectedCamera = useCallback(
		(update: (cameraEntry: CameraEntry) => CameraEntry) => {
			setCamera((prev) => {
				const normalized = normalizeCameraPayload(prev)
				const activeCameraId =
					normalized.activeCameraId ||
					selectedCameraId ||
					normalized.cameras?.[0]?.cameraId

				if (!activeCameraId) {
					return normalized
				}

				return {
					...normalized,
					activeCameraId,
					cameras: (normalized.cameras ?? []).map((cameraEntry) => {
						if (cameraEntry.cameraId !== activeCameraId) {
							return cameraEntry
						}
						return update(cameraEntry)
					})
				}
			})
		},
		[selectedCameraId, setCamera]
	)

	const handleCameraUpdate = useCallback(
		(key: string, value: number) => {
			updateSelectedCamera((cameraEntry) => ({
				...cameraEntry,
				[key]: value
			}))
		},
		[updateSelectedCamera]
	)

	const handleSelectCamera = useCallback(
		async (nextCameraId: string) => {
			const snapshot = await requestSceneCameraSnapshot()
			setSelectedCameraId(nextCameraId)
			setCamera((prev) => {
				const normalized = normalizeCameraPayload(prev)
				if (
					!(normalized.cameras ?? []).some(
						(entry) => entry.cameraId === nextCameraId
					)
				) {
					return normalized
				}

				const currentCameraId =
					normalized.activeCameraId ||
					selectedCameraId ||
					normalized.cameras?.[0]?.cameraId

				return {
					...normalized,
					activeCameraId: nextCameraId,
					cameras: (normalized.cameras ?? []).map((entry) => {
						const withSnapshot =
							entry.cameraId === currentCameraId
								? applySnapshotToCamera(entry, snapshot)
								: entry
						return withSnapshot
					})
				}
			})
		},
		[selectedCameraId, setCamera, setSelectedCameraId]
	)

	const handleAddCamera = useCallback(async () => {
		const snapshot = await requestSceneCameraSnapshot()
		const newCameraId = createId('camera')
		setCamera((prev) => {
			const normalized = normalizeCameraPayload(prev)
			const currentCameraId =
				normalized.activeCameraId ||
				selectedCameraId ||
				normalized.cameras?.[0]?.cameraId
			const sourceCamera =
				normalized.cameras?.find(
					(entry) => entry.cameraId === currentCameraId
				) ?? normalized.cameras?.[0]

			const newCamera: CameraEntry = {
				...applySnapshotToCamera(
					(sourceCamera ??
						defaultCameraOptions.cameras?.[0] ?? {
							cameraId: newCameraId,
							name: 'Camera'
						}) as CameraEntry,
					snapshot
				),
				cameraId: newCameraId,
				name: `Camera ${(normalized.cameras?.length ?? 0) + 1}`
			}

			return {
				...normalized,
				activeCameraId: newCameraId,
				cameras: [
					...(normalized.cameras ?? []).map((entry) => {
						return entry.cameraId === currentCameraId
							? applySnapshotToCamera(entry, snapshot)
							: entry
					}),
					newCamera
				]
			}
		})
		setSelectedCameraId(newCameraId)
	}, [selectedCameraId, setCamera, setSelectedCameraId])

	const handleDeleteCamera = useCallback(() => {
		setCamera((prev) => {
			const normalized = normalizeCameraPayload(prev)
			const cameras = normalized.cameras ?? []
			if (cameras.length <= 1) {
				return normalized
			}

			const targetId =
				normalized.activeCameraId || selectedCameraId || cameras[0]?.cameraId
			const remainingCameras = cameras.filter(
				(cameraEntry) => cameraEntry.cameraId !== targetId
			)
			const nextActiveCameraId = remainingCameras[0]?.cameraId
			if (!nextActiveCameraId) {
				return normalized
			}

			setSelectedCameraId(nextActiveCameraId)
			return {
				...normalized,
				activeCameraId: nextActiveCameraId,
				cameras: remainingCameras
			}
		})
	}, [selectedCameraId, setCamera, setSelectedCameraId])

	const handleRenameCamera = useCallback(
		(nextName: string) => {
			updateSelectedCamera((cameraEntry) => ({
				...cameraEntry,
				name: nextName
			}))
		},
		[updateSelectedCamera]
	)

	const handleCommitCameraName = useCallback(() => {
		handleRenameCamera(cameraNameDraft)
	}, [cameraNameDraft, handleRenameCamera])

	const handleSetDefaultCameraStrategy = useCallback(
		(strategy: DefaultCameraStrategy) => {
			setCamera((prev) => {
				const normalized = normalizeCameraPayload(prev)
				// When switching to manual, seed the manual id with the current active camera
				const manualId =
					strategy === 'manual'
						? (prev.defaultCameraId ??
							normalized.activeCameraId ??
							normalized.cameras?.[0]?.cameraId)
						: undefined
				return {
					...normalized,
					defaultCameraStrategy: strategy,
					defaultCameraId: manualId
				}
			})
		},
		[setCamera]
	)

	const handleSetDefaultCameraId = useCallback(
		(cameraId: string) => {
			setCamera((prev) => ({
				...normalizeCameraPayload(prev),
				defaultCameraStrategy: 'manual',
				defaultCameraId: cameraId
			}))
		},
		[setCamera]
	)

	const handlePreviewDefaultCamera = useCallback(() => {
		void handleSelectCamera(resolvedDefaultCameraId)
	}, [handleSelectCamera, resolvedDefaultCameraId])

	const handleCaptureCurrentView = useCallback(async () => {
		const snapshot = await requestSceneCameraSnapshot()
		if (!snapshot) return
		updateSelectedCamera((cameraEntry) => applySnapshotToCamera(cameraEntry, snapshot))
	}, [requestSceneCameraSnapshot, updateSelectedCamera])

	const handleTransitionUpdate = useCallback(
		(nextTransition: CameraTransitionConfig) => {
			setCamera((prev) => ({
				...prev,
				sceneTransition: nextTransition
			}))
		},
		[setCamera]
	)

	const handleTransitionTypeChange = useCallback(
		(nextType: CameraTransitionType) => {
			if (nextType === 'none') {
				handleTransitionUpdate({ type: 'none' })
				return
			}

			if (nextType === 'object_avoidance') {
				handleTransitionUpdate({
					type: 'object_avoidance',
					duration: selectedTransition.duration ?? 1000,
					easing: selectedTransition.easing ?? 'ease_in_out',
					objectAvoidance:
						selectedTransition.type === 'object_avoidance'
							? {
									clearance:
										selectedTransition.objectAvoidance?.clearance ??
										DEFAULT_OBJECT_AVOIDANCE.clearance,
									arcHeight:
										selectedTransition.objectAvoidance?.arcHeight ??
										DEFAULT_OBJECT_AVOIDANCE.arcHeight,
									samples:
										selectedTransition.objectAvoidance?.samples ??
										DEFAULT_OBJECT_AVOIDANCE.samples,
									tension:
										selectedTransition.objectAvoidance?.tension ??
										DEFAULT_OBJECT_AVOIDANCE.tension
								}
							: DEFAULT_OBJECT_AVOIDANCE
				})
				return
			}

			handleTransitionUpdate({
				type: 'linear',
				duration: selectedTransition.duration ?? 1000,
				easing: selectedTransition.easing ?? 'ease_in_out'
			})
		},
		[handleTransitionUpdate, selectedTransition]
	)

	const handleTransitionDurationChange = useCallback(
		(value: number) => {
			const nextDuration = Math.max(0, value)
			if (selectedTransition.type === 'object_avoidance') {
				handleTransitionUpdate({
					...selectedTransition,
					duration: nextDuration,
					objectAvoidance: {
						clearance:
							selectedTransition.objectAvoidance?.clearance ??
							DEFAULT_OBJECT_AVOIDANCE.clearance,
						arcHeight:
							selectedTransition.objectAvoidance?.arcHeight ??
							DEFAULT_OBJECT_AVOIDANCE.arcHeight,
						samples:
							selectedTransition.objectAvoidance?.samples ??
							DEFAULT_OBJECT_AVOIDANCE.samples,
						tension:
							selectedTransition.objectAvoidance?.tension ??
							DEFAULT_OBJECT_AVOIDANCE.tension
					}
				})
				return
			}

			handleTransitionUpdate({
				...selectedTransition,
				duration: nextDuration
			})
		},
		[handleTransitionUpdate, selectedTransition]
	)

	const handleTransitionEasingChange = useCallback(
		(easing: CameraTransitionEasing) => {
			if (selectedTransition.type === 'none') {
				return
			}

			handleTransitionUpdate({
				...selectedTransition,
				easing
			})
		},
		[handleTransitionUpdate, selectedTransition]
	)

	const handleObjectAvoidanceParamChange = useCallback(
		(key: 'clearance' | 'arcHeight' | 'samples' | 'tension', value: number) => {
			if (selectedTransition.type !== 'object_avoidance') {
				return
			}

			const normalizedValue =
				key === 'samples' ? Math.max(2, Math.round(value)) : value

			handleTransitionUpdate({
				...selectedTransition,
				objectAvoidance: {
					clearance:
						selectedTransition.objectAvoidance?.clearance ??
						DEFAULT_OBJECT_AVOIDANCE.clearance,
					arcHeight:
						selectedTransition.objectAvoidance?.arcHeight ??
						DEFAULT_OBJECT_AVOIDANCE.arcHeight,
					samples:
						selectedTransition.objectAvoidance?.samples ??
						DEFAULT_OBJECT_AVOIDANCE.samples,
					tension:
						selectedTransition.objectAvoidance?.tension ??
						DEFAULT_OBJECT_AVOIDANCE.tension,
					[key]: normalizedValue
				}
			})
		},
		[handleTransitionUpdate, selectedTransition]
	)

	return (
		<div className="space-y-6">
			{/* Camera Manager */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						Camera Manager
					</p>
					<InfoTooltip content="Select, create, rename, and delete saved cameras. The selected camera becomes the preview camera in the editor." />
				</div>
				<Separator />

				<div className="flex items-center gap-2">
					<Select
						value={selectedCamera?.cameraId ?? ''}
						onValueChange={(value) => {
							void handleSelectCamera(value)
						}}
					>
						<SelectTrigger className="flex-1">
							<SelectValue placeholder="Select camera" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectLabel className="text-xs">Scene Cameras</SelectLabel>
								{sceneCameras.map((cameraEntry) => (
									<SelectItem
										key={cameraEntry.cameraId}
										value={cameraEntry.cameraId}
									>
										<span className="flex items-center gap-1.5">
											{cameraEntry.cameraId === resolvedDefaultCameraId && (
												<Pin className="text-primary h-3 w-3 shrink-0" />
											)}
											{cameraEntry.name || 'Unnamed Camera'}
										</span>
									</SelectItem>
								))}
								{sceneCameras.length === 0 && (
									<SelectItem value="__none_scene" disabled>
										None
									</SelectItem>
								)}
							</SelectGroup>
							{hotspotCameras.length > 0 && (
								<SelectGroup>
									<SelectLabel className="text-xs">
										Hotspot Cameras
									</SelectLabel>
									{hotspotCameras.map((cameraEntry) => (
										<SelectItem
											key={cameraEntry.cameraId}
											value={cameraEntry.cameraId}
										>
											<span className="flex items-center gap-1.5">
												{cameraEntry.name || 'Unnamed Camera'}
												{hotspotNameByCameraId[cameraEntry.cameraId] && (
													<span className="text-muted-foreground text-xs">
														→ {hotspotNameByCameraId[cameraEntry.cameraId]}
													</span>
												)}
											</span>
										</SelectItem>
									))}
								</SelectGroup>
							)}
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						size="icon"
						onClick={() => {
							void handleAddCamera()
						}}
						title="Add camera"
					>
						<Plus />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleDeleteCamera}
						disabled={(normalizedCamera.cameras?.length ?? 0) <= 1}
						title="Delete camera"
					>
						<Trash2 />
					</Button>
					<Button
						variant="outline"
						size="icon"
						onClick={() => {
							void handleCaptureCurrentView()
						}}
						title="Capture current view into this camera"
					>
						<Camera />
					</Button>
				</div>

				<div className="space-y-1">
					<p className="text-muted-foreground text-xs">Camera Name</p>
					<Input
						value={cameraNameDraft}
						onChange={(event) => setCameraNameDraft(event.target.value)}
						onBlur={handleCommitCameraName}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault()
								handleCommitCameraName()
								return
							}

							if (event.key === 'Escape') {
								event.preventDefault()
								setCameraNameDraft(selectedCamera?.name ?? '')
							}
						}}
						placeholder="Camera name"
					/>
				</div>
			</div>

			{/* Default Camera */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						Default Camera
					</p>
					<InfoTooltip content="Choose which camera viewers see first. 'First' and 'Last' follow scene camera order; 'Manual' lets you pin a specific camera." />
				</div>
				<Separator />

				<div className="space-y-1.5">
					<p className="text-muted-foreground text-xs">Strategy</p>
					<ToggleButtonGroup
						options={DEFAULT_STRATEGY_OPTIONS}
						value={normalizedCamera.defaultCameraStrategy ?? 'first'}
						onChange={handleSetDefaultCameraStrategy}
					/>
				</div>

				{(normalizedCamera.defaultCameraStrategy ?? 'first') === 'manual' && (
					<div className="space-y-1.5">
						<p className="text-muted-foreground text-xs">Default Camera</p>
						<Select
							value={normalizedCamera.defaultCameraId ?? resolvedDefaultCameraId}
							onValueChange={handleSetDefaultCameraId}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select default camera" />
							</SelectTrigger>
							<SelectContent>
								{sceneCameras.map((cameraEntry) => (
									<SelectItem
										key={cameraEntry.cameraId}
										value={cameraEntry.cameraId}
									>
										{cameraEntry.name || 'Unnamed Camera'}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{resolvedDefaultCameraId &&
					selectedCamera?.cameraId !== resolvedDefaultCameraId && (
						<Button
							variant="outline"
							size="sm"
							className="w-full gap-1.5"
							onClick={handlePreviewDefaultCamera}
						>
							<Pin className="h-3.5 w-3.5" />
							Preview Default Camera
						</Button>
					)}
			</div>

			{/* Camera Settings */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						Camera Settings
					</p>
					<InfoTooltip content="Configure the selected camera's field of view." />
				</div>
				<Separator />

				<div className="space-y-1.5">
					<p className="text-muted-foreground text-xs">Field of View</p>
					<ToggleButtonGroup
						options={FOV_PRESETS}
						isActive={(v) =>
							getClosestFovPreset(selectedCamera?.fov ?? 60) === v
						}
						onChange={(v) => handleCameraUpdate('fov', v)}
					/>
					<EnhancedSettingSlider
						id="camera-fov"
						sliderProps={{
							min: 20,
							max: 120,
							step: 1,
							value: selectedCamera?.fov ?? 60,
							onChange: (value) => handleCameraUpdate('fov', value)
						}}
						label="Custom FOV"
						tooltip="Set a precise field of view value in degrees."
						labelProps={{ low: '20°', high: '120°' }}
						formatValue={(v) => `${Math.round(v)}°`}
						allowDirectInput
					/>
				</div>
			</div>

			{/* Camera Transition */}
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						Camera Transition
					</p>
					<InfoTooltip content="Define how switching to the selected camera is animated." />
				</div>
				<Separator />

				<div className="space-y-1.5">
					<p className="text-muted-foreground text-xs">Transition Type</p>
					<ToggleButtonGroup
						options={TRANSITION_TYPE_OPTIONS}
						value={selectedTransition.type}
						onChange={handleTransitionTypeChange}
					/>
				</div>

				{selectedTransition.type !== 'none' && (
					<>
						<div className="space-y-3">
							<div className="space-y-1.5">
								<p className="text-muted-foreground text-xs">Duration</p>
								<ToggleButtonGroup
									options={DURATION_PRESETS}
									isActive={(v) =>
										getClosestDurationPreset(
											selectedTransition.duration ?? 1000
										) === v
									}
									onChange={handleTransitionDurationChange}
								/>
								<EnhancedSettingSlider
									id="transition-duration"
									sliderProps={{
										min: 0,
										max: 5000,
										step: 50,
										value: selectedTransition.duration ?? 1000,
										onChange: handleTransitionDurationChange
									}}
									label="Custom Duration"
									tooltip="Set a precise transition duration in milliseconds."
									labelProps={{ low: '0ms', high: '5000ms' }}
									formatValue={(v) => `${Math.round(v)}ms`}
									allowDirectInput
								/>
							</div>

							<div className="space-y-1.5">
								<p className="text-muted-foreground text-xs">Easing</p>
								<ToggleButtonGroup
									options={TRANSITION_EASING_OPTIONS}
									value={selectedTransition.easing ?? 'ease_in_out'}
									onChange={handleTransitionEasingChange}
									columns={4}
								/>
							</div>
						</div>
					</>
				)}

				{selectedTransition.type === 'object_avoidance' && (
					<Collapsible
						open={transitionAdvancedOpen}
						onOpenChange={setTransitionAdvancedOpen}
					>
						<CollapsibleSectionTrigger isOpen={transitionAdvancedOpen}>
							Path settings
						</CollapsibleSectionTrigger>
						<CollapsibleContent className="space-y-4 pt-2">
							<EnhancedSettingSlider
								id="transition-avoidance-clearance"
								sliderProps={{
									min: 0,
									max: 20,
									step: 0.1,
									value:
										selectedTransition.objectAvoidance?.clearance ??
										DEFAULT_OBJECT_AVOIDANCE.clearance,
									onChange: (value) =>
										handleObjectAvoidanceParamChange('clearance', value)
								}}
								label="Obstacle Margin"
								tooltip="Extra space kept between the camera path and any obstacle."
								labelProps={{ low: '0', high: '20' }}
								formatValue={(value) => value.toFixed(1)}
								allowDirectInput={true}
							/>

							<EnhancedSettingSlider
								id="transition-avoidance-arc-height"
								sliderProps={{
									min: 0,
									max: 20,
									step: 0.1,
									value:
										selectedTransition.objectAvoidance?.arcHeight ??
										DEFAULT_OBJECT_AVOIDANCE.arcHeight,
									onChange: (value) =>
										handleObjectAvoidanceParamChange('arcHeight', value)
								}}
								label="Path Height"
								tooltip="How high the camera path arcs over obstacles."
								labelProps={{ low: '0', high: '20' }}
								formatValue={(value) => value.toFixed(1)}
								allowDirectInput={true}
							/>

							<EnhancedSettingSlider
								id="transition-avoidance-samples"
								sliderProps={{
									min: 2,
									max: 128,
									step: 1,
									value:
										selectedTransition.objectAvoidance?.samples ??
										DEFAULT_OBJECT_AVOIDANCE.samples,
									onChange: (value) =>
										handleObjectAvoidanceParamChange('samples', value)
								}}
								label="Path Smoothness"
								tooltip="Higher values create a smoother camera path around obstacles."
								labelProps={{ low: '2', high: '128' }}
								formatValue={(value) => `${Math.round(value)}`}
								allowDirectInput={true}
							/>

							<EnhancedSettingSlider
								id="transition-avoidance-tension"
								sliderProps={{
									min: 0,
									max: 1,
									step: 0.01,
									value:
										selectedTransition.objectAvoidance?.tension ??
										DEFAULT_OBJECT_AVOIDANCE.tension,
									onChange: (value) =>
										handleObjectAvoidanceParamChange('tension', value)
								}}
								label="Path Curve"
								tooltip="Controls how tightly the camera path follows the arc shape."
								labelProps={{ low: '0', high: '1' }}
								formatValue={(value) => value.toFixed(2)}
								allowDirectInput={true}
							/>
						</CollapsibleContent>
					</Collapsible>
				)}
			</div>
		</div>
	)
})

CameraControlsSettingsPanel.displayName = 'CameraControlsSettingsPanel'

export default CameraControlsSettingsPanel
