import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Slider, type SliderPreset } from '@shared/components/ui/slider'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { cn } from '@shared/utils'
import { useAtomValue } from 'jotai/react'
import {
	Camera,
	Check,
	Link,
	Pin,
	Plus,
	Route,
	Spline,
	Trash2
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
	DEFAULT_TRANSITION_DURATION,
	DEFAULT_TRANSITION_EASING,
	TRANSITION_EASING_OPTIONS,
	TRANSITION_TYPE_OPTIONS,
	withAvoidanceDefaults,
	type ObjectAvoidanceKey
} from './camera-state'
import { useSceneTransition } from './use-scene-transition'
import { canEditCameraSettingsAtom } from '../../../../../lib/stores/publisher-config-store'
import { InlineNotice } from '../../../../layout-components'
import { DrillDownTrigger } from '../../drill-down'
import { FieldSlider } from '../../field-slider'
import { SettingGroup, SettingRow } from '../../sidebar-section'

import type { SceneCameras } from './use-scene-cameras'
import type { FieldConfig } from '../../../../../types/settings-field'
import type { CameraTransitionEasing, CameraTransitionType } from '@vctrl/core'

const FOV_PRESETS: SliderPreset[] = [
	{ value: 35, label: 'Telephoto' },
	{ value: 60, label: 'Standard' },
	{ value: 90, label: 'Wide' }
]

const DURATION_PRESETS: SliderPreset[] = [
	{ value: 0, label: 'Instant' },
	{ value: 500, label: 'Quick' },
	{ value: 2000, label: 'Slow' }
]

const AVOIDANCE_FIELDS: FieldConfig<ObjectAvoidanceKey>[] = [
	{
		key: 'clearance',
		label: 'Obstacle margin',
		min: 0,
		max: 20,
		step: 0.1,
		formatValue: (value) => value.toFixed(1)
	},
	{
		key: 'arcHeight',
		label: 'Path height',
		min: 0,
		max: 20,
		step: 0.1,
		formatValue: (value) => value.toFixed(1)
	},
	{
		key: 'samples',
		label: 'Path smoothness',
		min: 2,
		max: 128,
		step: 1,
		formatValue: (value) => `${Math.round(value)}`
	},
	{
		key: 'tension',
		label: 'Path curve',
		min: 0,
		max: 1,
		step: 0.01,
		formatValue: (value) => value.toFixed(2)
	}
]

/** How long "View captured" stays on the button after a capture. */
const CAPTURED_FEEDBACK_MS = 1800

/** Camera editing is read-only in preview, where cameras are only reviewed. */
const useIsCameraEditingLocked = () => !useAtomValue(canEditCameraSettingsAtom)

interface CamerasProps {
	cameras: SceneCameras
}

/** The drill-down's root: every camera, and the way into transitions. */
export function CameraList({ cameras }: CamerasProps) {
	const isLocked = useIsCameraEditingLocked()
	const { transition } = useSceneTransition()
	const transitionLabel = TRANSITION_TYPE_OPTIONS.find(
		(option) => option.value === transition.type
	)?.label

	return (
		<>
			<SettingGroup
				label="Cameras"
				description="Choose a camera to edit it. The pinned one is where the scene opens."
				action={
					<Button
						variant="ghost"
						size="icon"
						className="size-7"
						disabled={isLocked}
						onClick={() => {
							void cameras.add()
						}}
						aria-label="Add camera"
					>
						<Plus className="size-4" />
					</Button>
				}
			>
				<div className="space-y-1.5">
					{cameras.cameras.map((entry) => {
						const isDefault = entry.cameraId === cameras.defaultCameraId
						const linkedHotspot = cameras.hotspotNameByCameraId[entry.cameraId]
						return (
							<DrillDownTrigger
								key={entry.cameraId}
								to="camera"
								focusKey={`camera:${entry.cameraId}`}
								onSelect={() => cameras.select(entry.cameraId)}
								disabled={isLocked}
								icon={
									isDefault ? <Pin /> : linkedHotspot ? <Link /> : <Camera />
								}
								label={entry.name || 'Unnamed camera'}
								summary={isDefault ? 'Default' : linkedHotspot}
							/>
						)
					})}
				</div>
			</SettingGroup>

			<DrillDownTrigger
				to="transitions"
				icon={<Route />}
				label="Transitions"
				summary={transitionLabel}
			/>
		</>
	)
}

/** One camera: its name, its view, its lens, and whether it opens the scene. */
export function CameraDetail({
	cameras,
	onDeleted
}: CamerasProps & { onDeleted: () => void }) {
	const isLocked = useIsCameraEditingLocked()
	const { selectedCamera } = cameras
	const savedName = selectedCamera?.name ?? ''
	const [nameDraft, setNameDraft] = useState(savedName)
	useEffect(() => {
		setNameDraft(savedName)
	}, [selectedCamera?.cameraId, savedName])

	const [capturedView, setCapturedView] = useState(false)
	const capturedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	useEffect(
		() => () => {
			if (capturedTimerRef.current) clearTimeout(capturedTimerRef.current)
		},
		[]
	)

	const handleCapture = async () => {
		if (!(await cameras.captureCurrentView())) return
		if (capturedTimerRef.current) clearTimeout(capturedTimerRef.current)
		setCapturedView(true)
		capturedTimerRef.current = setTimeout(
			() => setCapturedView(false),
			CAPTURED_FEEDBACK_MS
		)
	}

	return (
		<>
			<SettingRow label="Name">
				<Input
					value={nameDraft}
					disabled={isLocked}
					onChange={(event) => setNameDraft(event.target.value)}
					onBlur={() => cameras.renameSelected(nameDraft)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault()
							cameras.renameSelected(nameDraft)
						} else if (event.key === 'Escape') {
							event.preventDefault()
							setNameDraft(savedName)
						}
					}}
					placeholder="Enter camera name..."
					className="min-w-0 text-sm"
				/>
				{selectedCamera?.cameraId && (
					<p className="text-muted-foreground truncate px-0.5 font-mono text-xs">
						{selectedCamera.cameraId}
					</p>
				)}
			</SettingRow>

			<Button
				variant="secondary"
				disabled={isLocked}
				className={cn(
					'w-full transition-colors duration-300',
					capturedView &&
						'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400'
				)}
				onClick={() => {
					void handleCapture()
				}}
			>
				<span className="relative h-4 w-4 shrink-0">
					<Camera
						className={cn(
							'absolute inset-0 h-4 w-4 transition-all duration-200',
							capturedView ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
						)}
					/>
					<Check
						className={cn(
							'absolute inset-0 h-4 w-4 transition-all duration-200',
							capturedView ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
						)}
					/>
				</span>
				<span className="transition-all duration-200">
					{capturedView ? 'View captured' : 'Set camera to current view'}
				</span>
			</Button>

			<Slider
				label="Field of view"
				min={20}
				max={120}
				step={1}
				presets={FOV_PRESETS}
				formatValue={(value) => `${Math.round(value)}°`}
				disabled={isLocked}
				value={selectedCamera?.fov ?? 60}
				onValueChange={cameras.setFov}
			/>

			<div className="grid grid-cols-2 gap-2">
				<Button
					variant="secondary"
					disabled={isLocked || cameras.isEditingDefaultCamera}
					onClick={cameras.pinSelectedAsDefault}
				>
					<Pin className="size-4" />
					{cameras.isEditingDefaultCamera ? 'Default' : 'Make default'}
				</Button>
				<Button
					variant="ghost"
					onClick={() => {
						cameras.removeSelected()
						onDeleted()
					}}
					disabled={isLocked || !cameras.canDeleteSelected}
				>
					<Trash2 className="size-4" />
					Delete
				</Button>
			</div>
		</>
	)
}

/** How the view moves when a viewer switches cameras. */
export function TransitionSettings() {
	const isLocked = useIsCameraEditingLocked()
	const { transition, setType, setDuration, setEasing } = useSceneTransition()

	return (
		<>
			<ToggleGroup
				type="single"
				aria-label="Transition type"
				value={transition.type}
				disabled={isLocked}
				onValueChange={(value) => {
					if (value) setType(value as CameraTransitionType)
				}}
			>
				{TRANSITION_TYPE_OPTIONS.map((option) => (
					<ToggleGroupItem key={option.value} value={option.value}>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>

			{transition.type === 'object_avoidance' && (
				<InlineNotice>
					Smart transitions solve a path around the model. Framing is still
					unpredictable on some scenes, so check the result in preview before
					publishing.
				</InlineNotice>
			)}

			{transition.type !== 'none' && (
				<>
					<Slider
						label="Duration"
						min={0}
						max={5000}
						step={50}
						presets={DURATION_PRESETS}
						formatValue={(value) => `${Math.round(value)} ms`}
						disabled={isLocked}
						value={transition.duration ?? DEFAULT_TRANSITION_DURATION}
						onValueChange={setDuration}
					/>

					<SettingGroup label="Easing">
						<ToggleGroup
							type="single"
							aria-label="Transition easing"
							value={transition.easing ?? DEFAULT_TRANSITION_EASING}
							disabled={isLocked}
							onValueChange={(value) => {
								if (value) setEasing(value as CameraTransitionEasing)
							}}
							className="grid grid-cols-2"
						>
							{TRANSITION_EASING_OPTIONS.map((option) => (
								<ToggleGroupItem key={option.value} value={option.value}>
									{option.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</SettingGroup>
				</>
			)}

			{transition.type === 'object_avoidance' && (
				<DrillDownTrigger to="path" icon={<Spline />} label="Path settings" />
			)}
		</>
	)
}

/** How a smart transition's path clears the model. */
export function PathSettings() {
	const isLocked = useIsCameraEditingLocked()
	const { transition, setAvoidance } = useSceneTransition()
	const avoidance = withAvoidanceDefaults(transition.objectAvoidance)

	return AVOIDANCE_FIELDS.map((field) => (
		<FieldSlider
			key={field.key}
			field={field}
			value={avoidance[field.key]}
			onChange={setAvoidance}
			disabled={isLocked}
		/>
	))
}
