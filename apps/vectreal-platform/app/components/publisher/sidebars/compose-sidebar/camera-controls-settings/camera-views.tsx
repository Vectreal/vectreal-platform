import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Slider, type SliderPreset } from '@shared/components/ui/slider'
import { Reorder, useReducedMotion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import { ArrowUpToLine, Camera, Frame, Link, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { describeCameraLimits } from '../../../../../lib/domain/scene/camera-limits'
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
import type { ReactNode } from 'react'

const FOV_PRESETS: SliderPreset[] = [
	{ value: 35, label: 'Telephoto' },
	{ value: 60, label: 'Standard' },
	{ value: 90, label: 'Wide' }
]

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

/**
 * The drill-down's root: every camera, in the order visitors step through.
 * How visitors move between them is set in the Interaction tool.
 */
export function CameraList({ cameras, announce }: CamerasProps) {
	const isLocked = useIsCameraEditingLocked()

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

	// The moved actions leave once used, with focus in them; it goes to the
	// camera's heading rather than dropping to the page. The heading is found
	// before the action runs, since the action unmounts the button.
	const headingFocuser = (from: HTMLElement) => {
		const heading = from
			.closest('section')
			?.querySelector<HTMLElement>('[data-drill-down-heading]')
		return () => requestAnimationFrame(() => heading?.focus())
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

			{cameras.isViewMoved && !isLocked && (
				<div className="space-y-2">
					<Button
						className="w-full"
						onClick={async (event) => {
							const focusHeading = headingFocuser(event.currentTarget)
							await cameras.add()
							focusHeading()
						}}
					>
						<Plus className="size-4" />
						Save as new camera
					</Button>
					<Button
						variant="secondary"
						className="w-full min-w-0"
						onClick={async (event) => {
							const focusHeading = headingFocuser(event.currentTarget)
							if (await cameras.captureCurrentView()) focusHeading()
						}}
					>
						<Camera className="size-4 shrink-0" />
						<span className="truncate">
							Update “{cameraName(selectedCamera ?? {})}” to this view
						</span>
					</Button>
					<button
						type="button"
						className="shell-focus text-muted-foreground hover:text-foreground mx-auto block rounded-md px-1 py-0.5 text-xs font-medium underline-offset-4 transition-colors hover:underline"
						onClick={(event) => {
							const focusHeading = headingFocuser(event.currentTarget)
							cameras.backToCamera()
							focusHeading()
						}}
					>
						Back to camera
					</button>
				</div>
			)}

			<Slider
				label="Field of view"
				min={20}
				max={120}
				step={1}
				presets={FOV_PRESETS}
				formatValue={(value) => `${Math.round(value)}°`}
				disabled={isLocked}
				value={cameras.viewFov ?? 60}
				onValueChange={cameras.setFov}
			/>

			{cameras.limits && (
				<DrillDownTrigger
					to="limits"
					icon={<Frame />}
					label="Limits"
					summary={describeCameraLimits(cameras.limits)}
				/>
			)}

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
