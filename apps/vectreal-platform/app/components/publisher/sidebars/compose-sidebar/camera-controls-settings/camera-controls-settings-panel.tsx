import { Button } from '@shared/components/ui/button'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger
} from '@shared/components/ui/collapsible'
import { Input } from '@shared/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Separator } from '@shared/components/ui/separator'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { useAtom } from 'jotai/react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import {
	CAMERA_CONTROLS_FIELDS,
	CAMERA_FIELDS,
	defaultCameraOptions,
	defaultControlsOptions,
	type FieldConfig
} from './constants'
import {
	cameraAtom,
	controlsAtom,
	selectedCameraIdAtom
} from '../../../../../lib/stores/scene-settings-store'
import { InfoTooltip } from '../../../../info-tooltip'
import { usePublisherViewerCapture } from '../../../publisher-viewer-capture-context'
import {
	EnhancedSettingSlider,
	SettingToggle
} from '../../../settings-components'

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

const CameraField = memo(
	({
		config,
		value,
		onUpdate
	}: {
		config: FieldConfig
		value: number
		onUpdate: (key: string, value: number) => void
	}) => (
		<EnhancedSettingSlider
			id={config.key}
			sliderProps={{
				min: config.min,
				max: config.max,
				step: config.step,
				value:
					value ??
					(defaultCameraOptions.cameras?.[0]?.[
						config.key as keyof NonNullable<CameraProps['cameras']>[number]
					] as number),
				onChange: (newValue) => onUpdate(config.key, newValue)
			}}
			label={config.label}
			tooltip={config.tooltip}
			labelProps={{
				low: `${config.min}${config.unit || ''}`,
				high: `${config.max}${config.unit || ''}`
			}}
			formatValue={config.formatValue}
			valueMapping={config.valueMapping}
			allowDirectInput={true}
		/>
	)
)
CameraField.displayName = 'CameraField'

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

const TRANSITION_TYPE_OPTIONS: Array<{
	value: CameraTransitionType
	label: string
}> = [
	{ value: 'none', label: 'Instant' },
	{ value: 'linear', label: 'Linear' },
	{ value: 'object_avoidance', label: 'Smart' }
]

const TRANSITION_EASING_OPTIONS: Array<{
	value: CameraTransitionEasing
	label: string
}> = [
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

function normalizeCameraPayload(camera: CameraProps): CameraProps {
	const sourceCameras =
		camera.cameras && camera.cameras.length > 0
			? camera.cameras
			: (defaultCameraOptions.cameras ?? [])

	const flattenedCameras = sourceCameras.flatMap((entry, cameraIndex) => {
		if (entry.states && entry.states.length > 0) {
			return entry.states.map((stateEntry, stateIndex) => {
				const stateId =
					typeof stateEntry.stateId === 'string' && stateEntry.stateId.trim()
						? stateEntry.stateId.trim()
						: `${entry.cameraId || `camera-${cameraIndex + 1}`}-state-${stateIndex + 1}`
				const baseCameraName =
					typeof entry.name === 'string'
						? entry.name
						: `Camera ${cameraIndex + 1}`
				const stateName =
					typeof stateEntry.name === 'string'
						? stateEntry.name
						: `${baseCameraName} ${stateIndex + 1}`

				const transition =
					stateEntry.transition ??
					entry.transition ??
					(entry.shouldAnimate === false
						? { type: 'none' as const }
						: {
								type: 'linear' as const,
								duration: entry.animationConfig?.duration ?? 1000,
								easing: 'ease_in_out' as const
							})

				return {
					...entry,
					...stateEntry,
					cameraId: stateId,
					name: stateName,
					initial: Boolean(
						stateEntry.initial ||
						(entry.activeStateId && entry.activeStateId === stateId)
					),
					transition
				}
			})
		}

		return [
			{
				...entry,
				cameraId: entry.cameraId || `camera-${cameraIndex + 1}`,
				name:
					typeof entry.name === 'string'
						? entry.name
						: `Camera ${cameraIndex + 1}`,
				transition:
					entry.transition ??
					(entry.shouldAnimate === false
						? { type: 'none' as const }
						: {
								type: 'linear' as const,
								duration: entry.animationConfig?.duration ?? 1000,
								easing: 'ease_in_out' as const
							})
			}
		]
	})

	const seenCameraIds = new Set<string>()
	const normalizedCameras = flattenedCameras.map((entry, index) => {
		const rawCameraId = entry.cameraId || `camera-${index + 1}`
		const cameraId = seenCameraIds.has(rawCameraId)
			? `${rawCameraId}-${index + 1}`
			: rawCameraId
		seenCameraIds.add(cameraId)

		const {
			states: _states,
			activeStateId: _activeStateId,
			shouldAnimate: _shouldAnimate,
			animationConfig: _animationConfig,
			...cameraWithoutLegacyFields
		} = entry

		return {
			...cameraWithoutLegacyFields,
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

	return {
		...camera,
		activeCameraId,
		cameras: normalizedCameras.map((entry) => ({
			...entry,
			initial: entry.cameraId === activeCameraId
		}))
	}
}

const SPEED_FIELDS = ['autoRotateSpeed', 'zoomSpeed', 'rotateSpeed', 'panSpeed']
const ADVANCED_FIELDS = ['dampingFactor', 'maxPolarAngle']

const CameraControlsSettingsPanel = memo(() => {
	const [controls, setControls] = useAtom(controlsAtom)
	const [camera, setCamera] = useAtom(cameraAtom)
	const [selectedCameraId, setSelectedCameraId] = useAtom(selectedCameraIdAtom)
	const [cameraNameDraft, setCameraNameDraft] = useState('')
	const [transitionAdvancedOpen, setTransitionAdvancedOpen] = useState(false)
	const [controlsAdvancedOpen, setControlsAdvancedOpen] = useState(false)
	const { requestSceneCameraSnapshot } = usePublisherViewerCapture()

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
		() => getNormalizedTransition(selectedCamera?.transition),
		[selectedCamera?.transition]
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
							return {
								...cameraEntry,
								initial: false
							}
						}

						const updated = update(cameraEntry)
						return {
							...updated,
							initial: true
						}
					})
				}
			})
		},
		[selectedCameraId, setCamera]
	)

	const handleControlUpdate = useCallback(
		(key: string, value: number) => {
			setControls((prev) => ({
				...prev,
				[key]: value
			}))
		},
		[setControls]
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

						return {
							...withSnapshot,
							initial: withSnapshot.cameraId === nextCameraId
						}
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
				name: `Camera ${(normalized.cameras?.length ?? 0) + 1}`,
				initial: true
			}

			return {
				...normalized,
				activeCameraId: newCameraId,
				cameras: [
					...(normalized.cameras ?? []).map((entry) => {
						const withSnapshot =
							entry.cameraId === currentCameraId
								? applySnapshotToCamera(entry, snapshot)
								: entry

						return {
							...withSnapshot,
							initial: false
						}
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
				cameras: remainingCameras.map((cameraEntry) => ({
					...cameraEntry,
					initial: cameraEntry.cameraId === nextActiveCameraId
				}))
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

	const handleTransitionUpdate = useCallback(
		(nextTransition: CameraTransitionConfig) => {
			updateSelectedCamera((cameraEntry) => ({
				...cameraEntry,
				transition: nextTransition
			}))
		},
		[updateSelectedCamera]
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

	const handleToggle = useCallback(
		(key: keyof typeof controls, enabled: boolean) => {
			setControls((prev) => ({
				...prev,
				[key]: enabled
			}))
		},
		[setControls]
	)

	return (
		<div className="space-y-6">
			{/* Camera Manager */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Camera Manager
					</p>
					<InfoTooltip content="Select, create, rename, and delete saved cameras. The selected camera becomes the active runtime camera." />
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
							{(normalizedCamera.cameras ?? []).map((cameraEntry) => (
								<SelectItem
									key={cameraEntry.cameraId}
									value={cameraEntry.cameraId}
								>
									{cameraEntry.name || 'Unnamed Camera'}
								</SelectItem>
							))}
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

			{/* Camera Settings */}
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Camera Settings
					</p>
					<InfoTooltip content="Configure the selected camera's field of view and transform-level properties." />
				</div>
				<Separator />

				{CAMERA_FIELDS.map((config) => (
					<CameraField
						key={config.key}
						config={config}
						value={selectedCamera?.[config.key as keyof CameraEntry] as number}
						onUpdate={handleCameraUpdate}
					/>
				))}
			</div>

			{/* Camera Transition */}
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Camera Transition
					</p>
					<InfoTooltip content="Define how switching to the selected camera is animated." />
				</div>
				<Separator />

				<div className="space-y-1.5">
					<p className="text-muted-foreground text-xs">Transition Type</p>
					<ToggleGroup
						type="single"
						value={selectedTransition.type}
						onValueChange={(value) => {
							if (value)
								handleTransitionTypeChange(value as CameraTransitionType)
						}}
						variant="outline"
						className="w-full"
					>
						{TRANSITION_TYPE_OPTIONS.map((option) => (
							<ToggleGroupItem
								key={option.value}
								value={option.value}
								className="flex-1 text-xs"
							>
								{option.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>

				{selectedTransition.type !== 'none' && (
					<>
						<EnhancedSettingSlider
							id="transition-duration"
							sliderProps={{
								min: 0,
								max: 5000,
								step: 50,
								value: selectedTransition.duration ?? 1000,
								onChange: handleTransitionDurationChange
							}}
							label="Duration"
							tooltip="Duration of the camera transition in milliseconds."
							labelProps={{ low: '0ms', high: '5000ms' }}
							formatValue={(value) => `${Math.round(value)}ms`}
							allowDirectInput={true}
						/>

						<div className="space-y-1.5">
							<p className="text-muted-foreground text-xs">Easing</p>
							<ToggleGroup
								type="single"
								value={selectedTransition.easing ?? 'ease_in_out'}
								onValueChange={(value) => {
									if (value)
										handleTransitionEasingChange(
											value as CameraTransitionEasing
										)
								}}
								variant="outline"
								className="w-full"
							>
								{TRANSITION_EASING_OPTIONS.map((option) => (
									<ToggleGroupItem
										key={option.value}
										value={option.value}
										className="flex-1 text-xs"
									>
										{option.label}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</div>
					</>
				)}

				{selectedTransition.type === 'object_avoidance' && (
					<Collapsible
						open={transitionAdvancedOpen}
						onOpenChange={setTransitionAdvancedOpen}
					>
						<CollapsibleTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="text-muted-foreground hover:text-foreground w-full justify-between px-0 text-xs"
							>
								Path settings
								<ChevronDown
									className={`h-3.5 w-3.5 transition-transform ${transitionAdvancedOpen ? 'rotate-180' : ''}`}
								/>
							</Button>
						</CollapsibleTrigger>
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

			{/* Camera Controls */}
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Camera Controls
					</p>
					<InfoTooltip content="Configure how users can interact with the camera in your scene." />
				</div>
				<Separator />

				<SettingToggle
					enabled={!!controls.enableZoom}
					onToggle={(enabled) => handleToggle('enableZoom', enabled)}
					title="Enable Zoom"
					description="Allow users to zoom in and out."
				/>

				<SettingToggle
					enabled={!!controls.autoRotate}
					onToggle={(enabled) => handleToggle('autoRotate', enabled)}
					title="Auto Rotate"
					description="Automatically rotate the camera around the model."
				/>

				<p className="text-muted-foreground pt-2 text-xs font-medium">
					Interaction Speeds
				</p>

				{CAMERA_CONTROLS_FIELDS.filter((config) =>
					SPEED_FIELDS.includes(config.key)
				).map((config) => {
					const isEnabled =
						config.key === 'autoRotateSpeed'
							? !!controls.autoRotate
							: config.key === 'zoomSpeed'
								? !!controls.enableZoom
								: true

					return (
						<ControlField
							key={config.key}
							config={config}
							value={controls[config.key as keyof typeof controls] as number}
							onUpdate={handleControlUpdate}
							enabled={isEnabled}
						/>
					)
				})}

				<Collapsible
					open={controlsAdvancedOpen}
					onOpenChange={setControlsAdvancedOpen}
				>
					<CollapsibleTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground w-full justify-between px-0 text-xs"
						>
							Advanced controls
							<ChevronDown
								className={`h-3.5 w-3.5 transition-transform ${controlsAdvancedOpen ? 'rotate-180' : ''}`}
							/>
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="space-y-4 pt-2">
						{CAMERA_CONTROLS_FIELDS.filter((config) =>
							ADVANCED_FIELDS.includes(config.key)
						).map((config) => (
							<ControlField
								key={config.key}
								config={config}
								value={controls[config.key as keyof typeof controls] as number}
								onUpdate={handleControlUpdate}
							/>
						))}
					</CollapsibleContent>
				</Collapsible>
			</div>
		</div>
	)
})

CameraControlsSettingsPanel.displayName = 'CameraControlsSettingsPanel'

export default CameraControlsSettingsPanel
