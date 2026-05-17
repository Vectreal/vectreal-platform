import { Button } from '@shared/components/ui/button'
import {
	Collapsible,
	CollapsibleContent
} from '@shared/components/ui/collapsible'
import { Input } from '@shared/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import {
	Camera,
	Check,
	Eye,
	EyeOff,
	Link,
	Pin,
	Plus,
	Trash2
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
	defaultCameraOptions,
	defaultControlsOptions,
	type FieldConfig
} from './constants'
import {
	canEditCameraSettingsAtom,
	isPreviewModeAtom,
	processAtom
} from '../../../../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	hotspotsAtom,
	selectedCameraIdAtom
} from '../../../../../lib/stores/scene-settings-store'
import { usePublisherViewerCapture } from '../../../publisher-viewer-capture-context'
import {
	EnhancedSettingSlider,
	ToggleButtonGroup
} from '../../../settings-components'
import { CollapsibleSectionTrigger } from '../../accordion-components'
import { PresetButtonGroup } from '../../preset-button-group'
import {
	SidebarSection,
	SidebarSectionContent,
	SettingRow
} from '../../sidebar-section'

import type { ToggleButtonGroupOption } from '../../../settings-components'
import type {
	CameraProps,
	CameraTransitionConfig,
	CameraTransitionEasing,
	CameraTransitionType
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
		<SettingRow label={config.label}>
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
		</SettingRow>
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

function resolveFirstSceneCameraId(cameras: CameraEntry[]): string {
	return cameras[0]?.cameraId ?? ''
}

function resolveEditorTargetCameraId(
	normalizedCamera: CameraProps,
	selectedCameraId?: string
): string {
	return (
		selectedCameraId ??
		normalizedCamera.activeCameraId ??
		normalizedCamera.cameras?.[0]?.cameraId ??
		''
	)
}

function withImplicitFirstCameraDefault(camera: CameraProps): CameraProps {
	const firstSceneCameraId = resolveFirstSceneCameraId(camera.cameras ?? [])
	return {
		...camera,
		cameras: (camera.cameras ?? []).map((entry) => ({
			...entry,
			initial: entry.cameraId === firstSceneCameraId
		}))
	}
}

function normalizeCameraState(camera: CameraProps): CameraProps {
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

	const effectiveDefaultId = resolveFirstSceneCameraId(normalizedCameras)

	return withImplicitFirstCameraDefault({
		...camera,
		activeCameraId,
		cameras: normalizedCameras.map((entry) => ({
			...entry,
			initial: entry.cameraId === effectiveDefaultId
		}))
	})
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

const CameraControlsSettingsPanel = memo(() => {
	const [camera, setCamera] = useAtom(cameraAtom)
	const [selectedCameraId, setSelectedCameraId] = useAtom(selectedCameraIdAtom)
	const isPreviewMode = useAtomValue(isPreviewModeAtom)
	const canEditCameraSettings = useAtomValue(canEditCameraSettingsAtom)
	const setIsPreviewMode = useSetAtom(isPreviewModeAtom)
	const setProcessState = useSetAtom(processAtom)
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

	const normalizedCamera = useMemo(() => normalizeCameraState(camera), [camera])
	const selectedCamera = useMemo(
		() =>
			normalizedCamera.cameras?.find(
				(cameraEntry) => cameraEntry.cameraId === selectedCameraId
			) ??
			normalizedCamera.cameras?.find(
				(cameraEntry) =>
					cameraEntry.cameraId === normalizedCamera.activeCameraId
			) ??
			normalizedCamera.cameras?.[0],
		[normalizedCamera, selectedCameraId]
	)
	const selectedTransition = useMemo(
		() => getNormalizedTransition(normalizedCamera.sceneTransition),
		[normalizedCamera.sceneTransition]
	)

	const allCameras = useMemo(
		() => normalizedCamera.cameras ?? [],
		[normalizedCamera.cameras]
	)

	const resolvedDefaultCameraId = useMemo(
		() => resolveFirstSceneCameraId(normalizedCamera.cameras ?? []),
		[normalizedCamera.cameras]
	)

	const isCameraEditingLocked = !canEditCameraSettings

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

	const updateSelectedCameraEntry = useCallback(
		(update: (cameraEntry: CameraEntry) => CameraEntry) => {
			setCamera((prev) => {
				const normalized = normalizeCameraState(prev)
				// Always use the editor-selected camera as the target, not the viewport's active camera
				const targetCameraId = resolveEditorTargetCameraId(
					normalized,
					selectedCameraId
				)

				if (!targetCameraId) {
					return normalized
				}

				return withImplicitFirstCameraDefault({
					...normalized,
					cameras: (normalized.cameras ?? []).map((cameraEntry) => {
						if (cameraEntry.cameraId !== targetCameraId) {
							return cameraEntry
						}
						return update(cameraEntry)
					})
				})
			})
		},
		[selectedCameraId, setCamera]
	)

	const handleCameraUpdate = useCallback(
		(key: string, value: number) => {
			updateSelectedCameraEntry((cameraEntry) => ({
				...cameraEntry,
				[key]: value
			}))
		},
		[updateSelectedCameraEntry]
	)

	const captureCurrentViewSnapshot = useCallback(async () => {
		return requestSceneCameraSnapshot()
	}, [requestSceneCameraSnapshot])

	const persistSnapshotOnCamera = useCallback(
		(snapshot: null | SceneCameraSnapshot, cameraId: string) => {
			setCamera((prev) => {
				const normalized = normalizeCameraState(prev)
				if (!cameraId) return normalized

				return withImplicitFirstCameraDefault({
					...normalized,
					cameras: (normalized.cameras ?? []).map((entry) =>
						entry.cameraId === cameraId
							? applySnapshotToCamera(entry, snapshot)
							: entry
					)
				})
			})
		},
		[setCamera]
	)

	const handleSelectCamera = useCallback(
		async (nextCameraId: string) => {
			if (!isPreviewMode) {
				// Navigate mode: just change the editor selection, don't snap the viewport
				setSelectedCameraId(nextCameraId)
				return
			}

			// Preview mode: save current viewport to current camera, then transition to the new one
			const snapshot = await captureCurrentViewSnapshot()
			const currentCameraId = resolveEditorTargetCameraId(
				normalizedCamera,
				selectedCameraId
			)
			if (currentCameraId) {
				persistSnapshotOnCamera(snapshot, currentCameraId)
			}
			setSelectedCameraId(nextCameraId)
		},
		[
			captureCurrentViewSnapshot,
			isPreviewMode,
			normalizedCamera,
			persistSnapshotOnCamera,
			selectedCameraId,
			setSelectedCameraId
		]
	)

	const handleAddCamera = useCallback(async () => {
		const snapshot = await captureCurrentViewSnapshot()
		const newCameraId = createId('camera')
		setCamera((prev) => {
			const normalized = normalizeCameraState(prev)
			const currentCameraId = resolveEditorTargetCameraId(
				normalized,
				selectedCameraId
			)
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

			return withImplicitFirstCameraDefault({
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
			})
		})
		setSelectedCameraId(newCameraId)
	}, [
		captureCurrentViewSnapshot,
		selectedCameraId,
		setCamera,
		setSelectedCameraId
	])

	const handleDeleteCamera = useCallback(() => {
		setCamera((prev) => {
			const normalized = normalizeCameraState(prev)
			const cameras = normalized.cameras ?? []
			if (cameras.length <= 1) {
				return normalized
			}

			const targetId = resolveEditorTargetCameraId(normalized, selectedCameraId)
			const remainingCameras = cameras.filter(
				(cameraEntry) => cameraEntry.cameraId !== targetId
			)
			const nextActiveCameraId = remainingCameras[0]?.cameraId
			if (!nextActiveCameraId) {
				return normalized
			}

			setSelectedCameraId(nextActiveCameraId)
			return withImplicitFirstCameraDefault({
				...normalized,
				activeCameraId: nextActiveCameraId,
				cameras: remainingCameras
			})
		})
	}, [selectedCameraId, setCamera, setSelectedCameraId])

	const handleRenameCamera = useCallback(
		(nextName: string) => {
			updateSelectedCameraEntry((cameraEntry) => ({
				...cameraEntry,
				name: nextName
			}))
		},
		[updateSelectedCameraEntry]
	)

	const handleCommitCameraName = useCallback(() => {
		handleRenameCamera(cameraNameDraft)
	}, [cameraNameDraft, handleRenameCamera])

	const handlePinSelectedCameraAsDefault = useCallback(() => {
		if (!selectedCamera?.cameraId) {
			return
		}

		setCamera((prev) => {
			const normalized = normalizeCameraState(prev)
			const target = (normalized.cameras ?? []).find(
				(cameraEntry) => cameraEntry.cameraId === selectedCamera.cameraId
			)

			if (!target) {
				return normalized
			}

			const reorderedCameras = [
				target,
				...(normalized.cameras ?? []).filter(
					(cameraEntry) => cameraEntry.cameraId !== target.cameraId
				)
			]

			return withImplicitFirstCameraDefault({
				...normalized,
				cameras: reorderedCameras
			})
		})
	}, [selectedCamera?.cameraId, setCamera])

	const [capturedView, setCapturedView] = useState(false)
	const capturedViewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	)

	const handleCaptureCurrentView = useCallback(async () => {
		const snapshot = await captureCurrentViewSnapshot()
		if (!snapshot) return
		updateSelectedCameraEntry((cameraEntry) =>
			applySnapshotToCamera(cameraEntry, snapshot)
		)
		if (capturedViewTimerRef.current) clearTimeout(capturedViewTimerRef.current)
		setCapturedView(true)
		capturedViewTimerRef.current = setTimeout(
			() => setCapturedView(false),
			1800
		)
	}, [captureCurrentViewSnapshot, updateSelectedCameraEntry])

	const handleTransitionUpdate = useCallback(
		(nextTransition: CameraTransitionConfig) => {
			setCamera((prev) =>
				withImplicitFirstCameraDefault({
					...normalizeCameraState(prev),
					sceneTransition: nextTransition
				})
			)
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

	const handleEnterPreviewMode = useCallback(() => {
		if (!allCameras.length) {
			return
		}

		setProcessState((prev) => ({
			...prev,
			mode: 'compose',
			activeComposeTool: 'camera-controls',
			showSidebar: false,
			showPublishPanel: false
		}))

		setIsPreviewMode(true)
	}, [allCameras.length, setIsPreviewMode, setProcessState])

	const handleExitPreviewMode = useCallback(() => {
		setIsPreviewMode(false)
		setProcessState((prev) => ({
			...prev,
			mode: 'compose',
			activeComposeTool: 'camera-controls',
			showSidebar: true,
			showPublishPanel: false
		}))
	}, [setIsPreviewMode, setProcessState])

	return (
		<div className="space-y-8">
			<SidebarSection>
				<SidebarSectionContent>
					<div className="border-border/60 bg-muted/40 flex items-center justify-between rounded-xl border p-3">
						<div>
							<p className="text-sm font-semibold">Preview Mode</p>
							<p className="text-muted-foreground mt-0.5 text-xs">
								Lock editing and review saved cameras in sequence.
							</p>
						</div>
						<Button
							variant={isPreviewMode ? 'secondary' : 'default'}
							size="sm"
							disabled={!allCameras.length}
							onClick={
								isPreviewMode ? handleExitPreviewMode : handleEnterPreviewMode
							}
						>
							{isPreviewMode ? (
								<>
									<EyeOff className="mr-2 h-4 w-4" /> Exit
								</>
							) : (
								<>
									<Eye className="mr-2 h-4 w-4" /> Enter
								</>
							)}
						</Button>
					</div>
				</SidebarSectionContent>
			</SidebarSection>

			{/* Camera Manager */}
			<SidebarSection>
				<SidebarSectionContent>
					{isPreviewMode && (
						<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
							<p className="text-xs text-amber-700 dark:text-amber-400">
								Previewing through{' '}
								<span className="font-semibold">
									{selectedCamera?.name ?? 'camera'}
								</span>
								. Switch cameras to transition.
							</p>
						</div>
					)}

					{/* Camera Name */}
					<SettingRow label="Camera Name">
						<div className="flex w-full">
							<Input
								value={cameraNameDraft}
								disabled={isCameraEditingLocked}
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
								placeholder="Enter camera name..."
								className="text-sm"
							/>
							{/* Set current camera as default */}
							{resolvedDefaultCameraId &&
								selectedCamera?.cameraId !== resolvedDefaultCameraId && (
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												size="icon"
												variant="secondary"
												className="shrink-0"
												disabled={isCameraEditingLocked}
												onClick={handlePinSelectedCameraAsDefault}
												aria-label="Set selected camera as default"
											>
												<Pin className="h-3.5 w-3.5" />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="top">
											Set selected camera as default
										</TooltipContent>
									</Tooltip>
								)}
						</div>
					</SettingRow>

					{/* Camera Selector */}
					<SettingRow label="Select Camera">
						<div className="flex items-center gap-2">
							<Select
								value={selectedCamera?.cameraId ?? ''}
								disabled={isCameraEditingLocked}
								onValueChange={(value) => {
									void handleSelectCamera(value)
								}}
							>
								<SelectTrigger
									className={cn(
										'flex-1',
										isCameraEditingLocked && 'opacity-70'
									)}
								>
									<SelectValue placeholder="Select camera" />
								</SelectTrigger>
								<SelectContent>
									{allCameras.length === 0 ? (
										<SelectItem value="__none" disabled>
											None
										</SelectItem>
									) : (
										allCameras.map((cameraEntry) => (
											<SelectItem
												key={cameraEntry.cameraId}
												value={cameraEntry.cameraId}
											>
												<span className="flex items-center gap-1.5">
													{cameraEntry.cameraId === resolvedDefaultCameraId && (
														<Pin className="text-primary h-3 w-3 shrink-0" />
													)}
													{cameraEntry.name || 'Unnamed Camera'}
													{hotspotNameByCameraId[cameraEntry.cameraId] && (
														<Link
															className="text-muted-foreground h-3 w-3 shrink-0"
															// title={`Linked to: ${hotspotNameByCameraId[cameraEntry.cameraId]}`}
														/>
													)}
												</span>
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
							<div className="flex items-center gap-1">
								<Button
									variant="outline"
									size="icon"
									className="h-9 w-9"
									disabled={isCameraEditingLocked}
									onClick={() => {
										void handleAddCamera()
									}}
									title="Add camera"
								>
									<Plus className="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-9 w-9"
									onClick={handleDeleteCamera}
									disabled={
										isCameraEditingLocked ||
										(normalizedCamera.cameras?.length ?? 0) <= 1
									}
									title="Delete camera"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</SettingRow>
					<Button
						variant="secondary"
						disabled={isCameraEditingLocked}
						className={`w-full transition-colors duration-300${capturedView ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400' : ''}`}
						onClick={() => {
							void handleCaptureCurrentView()
						}}
						title="Capture current view into this camera"
					>
						<span className="relative h-4 w-4 shrink-0">
							<Camera
								className={`absolute inset-0 h-4 w-4 transition-all duration-200${capturedView ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`}
							/>
							<Check
								className={`absolute inset-0 h-4 w-4 transition-all duration-200${capturedView ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
							/>
						</span>
						<span className="transition-all duration-200">
							{capturedView ? 'View captured' : 'Set camera to current view'}
						</span>
					</Button>
				</SidebarSectionContent>
			</SidebarSection>

			{/* Camera Settings */}
			<SidebarSection
				title="Camera Settings"
				tooltip="Configure the selected camera's field of view."
			>
				<SidebarSectionContent
					className={cn(
						isCameraEditingLocked && 'pointer-events-none opacity-50'
					)}
				>
					{/* Field of View Presets */}
					<PresetButtonGroup label="Field of View">
						<ToggleButtonGroup
							options={FOV_PRESETS}
							isActive={(v) =>
								getClosestFovPreset(selectedCamera?.fov ?? 60) === v
							}
							onChange={(v) => handleCameraUpdate('fov', v)}
						/>
					</PresetButtonGroup>

					{/* Custom FOV Slider */}
					{/* <SettingRow label="Custom FOV">
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
					</SettingRow> */}
				</SidebarSectionContent>
			</SidebarSection>

			{/* Camera Transition */}
			<SidebarSection
				title="Camera Transition"
				tooltip="Define how switching to the selected camera is animated."
			>
				<SidebarSectionContent
					className={cn(
						isCameraEditingLocked && 'pointer-events-none opacity-50'
					)}
				>
					{/* Transition Type */}
					<PresetButtonGroup label="Transition Type">
						<ToggleButtonGroup
							options={TRANSITION_TYPE_OPTIONS}
							value={selectedTransition.type}
							onChange={handleTransitionTypeChange}
						/>
					</PresetButtonGroup>

					{/* Duration & Easing (Shown when not Instant) */}
					{selectedTransition.type !== 'none' && (
						<div className="space-y-4 pt-2">
							{/* Duration Presets */}
							<PresetButtonGroup label="Duration">
								<ToggleButtonGroup
									options={DURATION_PRESETS}
									isActive={(v) =>
										getClosestDurationPreset(
											selectedTransition.duration ?? 1000
										) === v
									}
									onChange={handleTransitionDurationChange}
								/>
							</PresetButtonGroup>

							{/* Custom Duration Slider */}
							{/* <SettingRow label="Custom Duration">
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
							</SettingRow> */}

							{/* Easing */}
							<PresetButtonGroup label="Easing">
								<ToggleButtonGroup
									options={TRANSITION_EASING_OPTIONS}
									value={selectedTransition.easing ?? 'ease_in_out'}
									onChange={handleTransitionEasingChange}
									columns={4}
								/>
							</PresetButtonGroup>
						</div>
					)}

					{/* Smart Transition Settings */}
					{selectedTransition.type === 'object_avoidance' && (
						<Collapsible
							open={transitionAdvancedOpen}
							onOpenChange={setTransitionAdvancedOpen}
						>
							<CollapsibleSectionTrigger isOpen={transitionAdvancedOpen}>
								Path settings
							</CollapsibleSectionTrigger>
							<CollapsibleContent className="space-y-4 pt-4">
								<SettingRow label="Obstacle Margin">
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
								</SettingRow>

								<SettingRow label="Path Height">
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
								</SettingRow>

								<SettingRow label="Path Smoothness">
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
								</SettingRow>

								<SettingRow label="Path Curve">
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
								</SettingRow>
							</CollapsibleContent>
						</Collapsible>
					)}
				</SidebarSectionContent>
			</SidebarSection>
		</div>
	)
})

CameraControlsSettingsPanel.displayName = 'CameraControlsSettingsPanel'

export default CameraControlsSettingsPanel
