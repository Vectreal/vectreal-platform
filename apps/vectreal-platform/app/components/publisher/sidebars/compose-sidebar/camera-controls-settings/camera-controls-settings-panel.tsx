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
import { Separator } from '@shared/components/ui/separator'
import { useAtom } from 'jotai/react'
import { Plus, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import {
	defaultCameraOptions,
	defaultControlsOptions,
	type FieldConfig
} from './constants'
import {
	cameraAtom,
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
	const [cameraNameDraft, setCameraNameDraft] = useState('')
	const [transitionAdvancedOpen, setTransitionAdvancedOpen] = useState(false)
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

	return (
		<div className="space-y-6">
			{/* Camera Manager */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
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
