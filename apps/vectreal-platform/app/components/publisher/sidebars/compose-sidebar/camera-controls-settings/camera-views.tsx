import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Slider, type SliderPreset } from '@shared/components/ui/slider'
import { Toggle } from '@shared/components/ui/toggle'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { cn } from '@shared/utils'
import { DEFAULT_SCENE_TRANSITION } from '@vctrl/core'
import { Reorder, useReducedMotion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import {
	ArrowUpToLine,
	Camera,
	Check,
	Link,
	Plus,
	Route,
	Trash2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
	TRANSITION_EASING_OPTIONS,
	TRANSITION_TYPE_OPTIONS
} from './camera-state'
import { useCameraSwitcherSetting } from './use-camera-switcher-setting'
import { useSceneTransition } from './use-scene-transition'
import { canEditCameraSettingsAtom } from '../../../../../lib/stores/publisher-config-store'
import { DrillDownTrigger } from '../../drill-down'
import { SettingGroup, SettingRow } from '../../sidebar-section'
import {
	ReorderHandle,
	ReorderHandleSpacer,
	ReorderItem,
	useReorderDraft,
	type ReorderOutcome
} from '../reorder-list'

import type { SceneCameras } from './use-scene-cameras'
import type { CameraTransitionEasing, CameraTransitionType } from '@vctrl/core'
import type { ReactNode } from 'react'

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

/** How long "View captured" stays on the button after a capture. */
const CAPTURED_FEEDBACK_MS = 1800

/** Camera editing is read-only in preview, where cameras are only reviewed. */
const useIsCameraEditingLocked = () => !useAtomValue(canEditCameraSettingsAtom)

/** Id of the hint every camera reorder handle points at; the panel renders it once. */
export const CAMERA_REORDER_HINT_ID = 'camera-reorder-hint'

interface CamerasProps {
	cameras: SceneCameras
	announce: (message: string) => void
}

const cameraName = (entry: { name?: string }) => entry.name || 'Unnamed camera'

/** The opening view is the news in a move, so it is what a landing at the top says. */
const describeCameraMove = (
	name: string,
	{ position, total }: ReorderOutcome
) =>
	position === 1
		? `${name} moved to position 1 of ${total}. The scene now opens on it.`
		: `${name} moved to position ${position} of ${total}.`

/**
 * One camera's row: the trigger that opens it, with a reorder handle in front
 * for a scene camera, or the handle's empty place for a hotspot's.
 */
function CameraRow({
	cameras,
	entry,
	isLocked,
	handle
}: {
	cameras: SceneCameras
	entry: SceneCameras['cameras'][number]
	isLocked: boolean
	handle: ReactNode
}) {
	const isDefault = entry.cameraId === cameras.defaultCameraId
	const linkedHotspot = cameras.hotspotNameByCameraId[entry.cameraId]
	return (
		<div className="flex items-center gap-1">
			{handle}
			<DrillDownTrigger
				to="camera"
				focusKey={`camera:${entry.cameraId}`}
				onSelect={() => cameras.select(entry.cameraId)}
				disabled={isLocked}
				icon={linkedHotspot ? <Link /> : <Camera />}
				label={cameraName(entry)}
				summary={isDefault ? 'Opening view' : linkedHotspot}
				className="min-w-0 flex-1"
			/>
		</div>
	)
}

/**
 * Every camera, scene cameras first and draggable. Their order is the order
 * the switcher steps through and the first is the opening view; a hotspot's
 * camera is reached through its marker, so it sits after them and stays put.
 */
function CameraRows({
	cameras,
	announce,
	isLocked
}: CamerasProps & { isLocked: boolean }) {
	const reduceMotion = useReducedMotion() ?? false
	const ids = useMemo(
		() => cameras.sceneCameras.map((entry) => entry.cameraId),
		[cameras.sceneCameras]
	)
	const { reorder } = cameras
	const commit = useCallback(
		(order: string[], movedId: string) => reorder(order, movedId),
		[reorder]
	)
	const draft = useReorderDraft({
		ids,
		commit,
		announce,
		describeMove: describeCameraMove
	})

	// Locked (preview) lists nothing to drag, so no row keeps a handle's place.
	const spacer = isLocked ? null : <ReorderHandleSpacer />

	return (
		<div className="space-y-1.5">
			<Reorder.Group
				axis="y"
				role="list"
				values={draft.draftOrder}
				onReorder={draft.applyDraftOrder}
				className="space-y-1.5"
			>
				{draft.draftOrder.map((id) => {
					const entry = cameras.sceneCameras.find(
						(camera) => camera.cameraId === id
					)
					if (!entry) return null
					const name = cameraName(entry)
					return (
						<ReorderItem
							key={id}
							value={id}
							reduceMotion={reduceMotion}
							onDragStart={draft.startDrag}
							onDragEnd={() => draft.endDrag(id, name)}
						>
							{(dragControls) => (
								<CameraRow
									cameras={cameras}
									entry={entry}
									isLocked={isLocked}
									handle={
										isLocked ? null : (
											<ReorderHandle
												name={name}
												hintId={CAMERA_REORDER_HINT_ID}
												dragControls={dragControls}
												onMove={(delta) =>
													draft.moveByKeyboard(id, name, delta)
												}
											/>
										)
									}
								/>
							)}
						</ReorderItem>
					)
				})}
			</Reorder.Group>
			{cameras.otherCameras.length > 0 && (
				<ul role="list" className="space-y-1.5">
					{cameras.otherCameras.map((entry) => (
						<li key={entry.cameraId}>
							<CameraRow
								cameras={cameras}
								entry={entry}
								isLocked={isLocked}
								handle={spacer}
							/>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

/** The drill-down's root: every camera, the switcher, and the way into transitions. */
export function CameraList({ cameras, announce }: CamerasProps) {
	const isLocked = useIsCameraEditingLocked()
	const { transition } = useSceneTransition()
	const switcher = useCameraSwitcherSetting()
	const transitionLabel = TRANSITION_TYPE_OPTIONS.find(
		(option) => option.value === transition.type
	)?.label

	return (
		<>
			<SettingGroup
				label="Cameras"
				description="Drag to set the order visitors step through. The scene opens on the first camera."
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
				<CameraRows cameras={cameras} announce={announce} isLocked={isLocked} />
			</SettingGroup>

			<Toggle
				label="Camera switcher"
				description={
					switcher.available
						? 'Lets visitors step between these cameras in the published scene.'
						: 'Shown once the scene has two cameras to switch between.'
				}
				checked={switcher.shown}
				disabled={isLocked || !switcher.available}
				onCheckedChange={switcher.setShown}
			/>

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
	announce,
	onDeleted
}: CamerasProps & { onDeleted: () => void }) {
	const isLocked = useIsCameraEditingLocked()
	const { selectedCamera } = cameras
	// A hotspot's camera is not in the switcher's order, so it has no top to move to.
	const isOrderedCamera =
		!!selectedCamera && cameras.sceneCameras.includes(selectedCamera)
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
				{/*
				  On the opening camera the button is aria-disabled, not disabled:
				  it turns into "Opening view" in the same commit as its own click,
				  and a disabled button drops keyboard focus to the page.
				*/}
				<Button
					variant="secondary"
					disabled={isLocked || !isOrderedCamera}
					aria-disabled={cameras.isEditingDefaultCamera || undefined}
					className="aria-disabled:cursor-default aria-disabled:opacity-50"
					onClick={() => {
						if (cameras.isEditingDefaultCamera) return
						if (cameras.moveSelectedToTop() && selectedCamera) {
							announce(
								`${cameraName(selectedCamera)} moved to the top. The scene now opens on it.`
							)
						}
					}}
				>
					<ArrowUpToLine className="size-4" />
					{cameras.isEditingDefaultCamera ? 'Opening view' : 'Move to top'}
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
						value={transition.duration ?? DEFAULT_SCENE_TRANSITION.duration}
						onValueChange={setDuration}
					/>

					<SettingGroup label="Easing">
						<ToggleGroup
							type="single"
							aria-label="Transition easing"
							value={transition.easing ?? DEFAULT_SCENE_TRANSITION.easing}
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
		</>
	)
}
