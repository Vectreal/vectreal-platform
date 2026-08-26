import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger
} from '@shared/components/ui/collapsible'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle
} from '@shared/components/ui/empty'
import { Input } from '@shared/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { resolveHotspotMarkers } from '@vctrl/viewer'
import { AnimatePresence, Reorder, motion, useDragControls, useReducedMotion } from 'framer-motion'
import { useAtom, useSetAtom } from 'jotai/react'
import {
	ChevronDown,
	Crosshair,
	EyeOff,
	GripVertical,
	Locate,
	Plus,
	SquarePen,
	Trash2
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'


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
import {
	reorderSequence,
	setSequenceMembership
} from '../../../../lib/domain/scene/scene-hotspot-sequence'
import { isClickToPlaceActiveAtom } from '../../../../lib/stores/publisher-config-store'
import {
	activeHotspotIdAtom,
	cameraAtom,
	hotspotsAtom,
	selectedCameraIdAtom
} from '../../../../lib/stores/scene-settings-store'
import { InlineNotice } from '../../../layout-components'
import { SettingToggle, ToggleButtonGroup } from '../../settings-components'
import { SidebarSection, SidebarSectionContent, SettingGroup } from '../sidebar-section'

import type { ToggleButtonGroupOption } from '../../settings-components'
import type {
	CameraProps,
	HotspotDefinition,
	HotspotStylePreset
} from '@vctrl/core'
import type { DragControls } from 'framer-motion'
import type { ReactNode } from 'react'

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

const AXES = ['X', 'Y', 'Z'] as const

const sequencedFirst = (hotspots: readonly HotspotDefinition[]) => {
	const inSequence = hotspots
		.filter((hotspot) => hotspot.sequenceIndex !== undefined)
		.sort((a, b) => (a.sequenceIndex as number) - (b.sequenceIndex as number))

	return {
		inSequence,
		rest: hotspots.filter((hotspot) => hotspot.sequenceIndex === undefined)
	}
}

/**
 * One axis of the world-space position.
 *
 * The label is a prefix inside the well rather than a line above it: three
 * stacked label lines cost about 54px in a 304px column where everything below
 * the style presets is already off screen. The focus ring moves to the well so
 * the affordance still reads at the size the input ends up.
 *
 * `SettingRow`'s label is a sibling with no `htmlFor`, so it names nothing to a
 * screen reader. Until that is fixed in its owner, every field here carries its
 * own `aria-label`.
 */
const AxisField = memo(
	({
		axis,
		value,
		onChange
	}: {
		axis: (typeof AXES)[number]
		value: number
		onChange: (raw: string) => void
	}) => (
		<div className="publisher-shell-nested focus-within:ring-ring flex items-center rounded-lg pl-2 focus-within:ring-2">
			<span
				aria-hidden
				className="text-muted-foreground text-label-xs w-3 shrink-0 font-medium"
			>
				{axis}
			</span>
			<Input
				type="number"
				step="0.1"
				aria-label={`${axis} position`}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="h-8 border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-0"
			/>
		</div>
	)
)

AxisField.displayName = 'AxisField'

interface HotspotRowProps {
	hotspot: HotspotDefinition
	/** The step a visitor is shown, or null when this marker is outside the sequence. */
	step: number | null
	isOpen: boolean
	reduceMotion: boolean
	/** Present only for a marker in the sequence, which is the only one that reorders. */
	dragControls?: DragControls
	onOpenChange: (open: boolean) => void
	onDelete: () => void
	onMove?: (delta: number | 'first' | 'last') => void
	children: ReactNode
}

/**
 * One marker: a header row that is always visible, and its editor underneath.
 *
 * Being open *is* being selected. The panel used to fill the selected row with
 * brand at 80% and print its coordinates on top in `--muted-foreground`, around
 * 1.1:1 in dark. Expressing selection by disclosure instead means the state
 * needs no colour at all, which is also what the surface ladder asks for:
 * `globals.css` separates surfaces by value, never by an outline.
 */
const HotspotRow = memo(
	({
		hotspot,
		step,
		isOpen,
		reduceMotion,
		dragControls,
		onOpenChange,
		onDelete,
		onMove,
		children
	}: HotspotRowProps) => {
		const name = hotspot.name || 'Unnamed hotspot'
		const hiddenFromViewers = !hotspot.visible || hotspot.internalOnly

		return (
			<Collapsible
				open={isOpen}
				onOpenChange={onOpenChange}
				className="overflow-hidden rounded-xl"
			>
				<div className="publisher-shell-nested-interactive flex items-center gap-1 pr-1">
					{dragControls && onMove ? (
						<button
							type="button"
							aria-label={`Reorder ${name}`}
							aria-keyshortcuts="ArrowUp ArrowDown Home End"
							onPointerDown={(event) => dragControls.start(event)}
							onKeyDown={(event) => {
								const move = {
									ArrowUp: -1,
									ArrowDown: 1,
									Home: 'first',
									End: 'last'
								}[event.key] as number | 'first' | 'last' | undefined

								if (move === undefined) return
								event.preventDefault()
								onMove(move)
							}}
							className="publisher-shell-focus text-muted-foreground hover:text-foreground ml-1 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md active:cursor-grabbing"
						>
							<GripVertical aria-hidden className="size-3.5" />
						</button>
					) : (
						<span aria-hidden className="ml-1 size-6 shrink-0" />
					)}

					{step === null ? (
						<span
							aria-hidden
							className="text-muted-foreground/60 text-label-xs flex size-5 shrink-0 items-center justify-center"
						>
							&mdash;
						</span>
					) : (
						<Badge
							variant="secondary"
							aria-hidden
							className="text-label-xs flex size-5 shrink-0 justify-center px-0 tabular-nums"
						>
							{step}
						</Badge>
					)}

					<CollapsibleTrigger asChild>
						<button
							type="button"
							className="publisher-shell-focus flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-1 pl-1 text-left"
						>
							<span className="min-w-0 flex-1">
							<span
								className={cn(
									'block truncate text-sm leading-tight font-medium',
									hiddenFromViewers && 'opacity-60'
								)}
							>
								{name}
							</span>
							<span className="text-muted-foreground text-label-xs block font-mono tabular-nums">
								{hotspot.worldPosition.map((axis) => axis.toFixed(2)).join(', ')}
							</span>
							<span className="sr-only">
								{step === null ? ', not in the sequence' : `, step ${step}`}
								{hotspot.internalOnly
									? ', editor only'
									: hotspot.visible
										? ''
										: ', hidden from viewers'}
							</span>
							</span>
							<ChevronDown
								aria-hidden
								className={cn(
									'text-muted-foreground size-3.5 shrink-0 transition-transform duration-150',
									isOpen && 'rotate-180',
									reduceMotion && 'transition-none'
								)}
							/>
						</button>
					</CollapsibleTrigger>

					{!hotspot.visible && (
						<Tooltip>
							<TooltipTrigger asChild>
								<EyeOff
									aria-hidden
									className="text-muted-foreground size-3.5 shrink-0"
								/>
							</TooltipTrigger>
							<TooltipContent>Hidden from viewers</TooltipContent>
						</Tooltip>
					)}
					{hotspot.internalOnly && (
						<Tooltip>
							<TooltipTrigger asChild>
								<SquarePen
									aria-hidden
									className="text-muted-foreground size-3.5 shrink-0"
								/>
							</TooltipTrigger>
							<TooltipContent>Editor only</TooltipContent>
						</Tooltip>
					)}

					<Button
						variant="ghost"
						size="icon"
						aria-label={`Delete ${name}`}
						onClick={onDelete}
						className="publisher-shell-focus text-muted-foreground hover:text-destructive size-7 shrink-0"
					>
						<Trash2 aria-hidden className="size-3.5" />
					</Button>

				</div>

				<CollapsibleContent
					className={cn(
						'publisher-shell-nested overflow-hidden',
						'data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
						'motion-reduce:animate-none'
					)}
				>
					<div className="space-y-4 px-3 pt-3 pb-4">{children}</div>
				</CollapsibleContent>
			</Collapsible>
		)
	}
)

HotspotRow.displayName = 'HotspotRow'

/**
 * A marker in the sequence, wrapped so it can be dragged.
 *
 * `useDragControls` is a hook, so it cannot be called inside the `map` that
 * renders the list; one row owning one controller is what lets the drag start
 * from the handle alone rather than from anywhere on the row, which would make
 * the row impossible to click.
 */
const SequencedRow = ({
	id,
	reduceMotion,
	onDragStart,
	onDragEnd,
	...rowProps
}: Omit<HotspotRowProps, 'dragControls'> & {
	id: string
	onDragStart: () => void
	onDragEnd: () => void
}) => {
	const dragControls = useDragControls()

	return (
		<Reorder.Item
			value={id}
			dragListener={false}
			dragControls={dragControls}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			layout={reduceMotion ? undefined : 'position'}
			transition={
				reduceMotion
					? { duration: 0 }
					: { type: 'spring', stiffness: 600, damping: 40 }
			}
			whileDrag={reduceMotion ? undefined : { scale: 1.02 }}
			className="rounded-xl"
		>
			<HotspotRow
				{...rowProps}
				reduceMotion={reduceMotion}
				dragControls={dragControls}
			/>
		</Reorder.Item>
	)
}

const HotspotsSettingsPanel = memo(() => {
	const [hotspots, setHotspots] = useAtom(hotspotsAtom)
	const [camera, setCamera] = useAtom(cameraAtom)
	const [selectedId, setSelectedId] = useAtom(activeHotspotIdAtom)
	const setSelectedCameraId = useSetAtom(selectedCameraIdAtom)
	const [isClickToPlaceActive, setIsClickToPlaceActive] = useAtom(
		isClickToPlaceActiveAtom
	)

	const reduceMotion = useReducedMotion() ?? false
	const [announcement, setAnnouncement] = useState('')
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

	/**
	 * Both pieces of canvas state this panel takes are handed back when it goes.
	 *
	 * The selection is not bookkeeping: `activeHotspotIdAtom` is what puts the
	 * transform gizmo on the model, and `DynamicSidebar` unmounts the panel when
	 * the drawer closes. Keeping it left a gizmo floating over the scene with no
	 * panel to explain it and nothing to dismiss it with, under a tool that was
	 * no longer open.
	 */
	useEffect(
		() => () => {
			setIsClickToPlaceActive(false)
			setSelectedId(null)
		},
		[setIsClickToPlaceActive, setSelectedId]
	)

	const { inSequence, rest } = useMemo(
		() => sequencedFirst(hotspots),
		[hotspots]
	)

	/**
	 * The step a visitor is actually shown.
	 *
	 * `resolveHotspotMarkers` owns this rule in `@vctrl/viewer`, and it ranks
	 * among reachable markers rather than printing `sequenceIndex + 1`. Computing
	 * an ordinal here instead would put a number on the row that nobody browsing
	 * the published scene ever sees — a hidden marker holding a slot shifts every
	 * step after it.
	 */
	const stepById = useMemo(() => {
		const steps = new Map<string, number>()
		for (const marker of resolveHotspotMarkers(hotspots)) {
			if (marker.step !== null) steps.set(marker.id, marker.step)
		}
		return steps
	}, [hotspots])

	/**
	 * The order the list shows while a drag is in flight.
	 *
	 * `Reorder.Group` fires `onReorder` on every adjacent swap, and `hotspotsAtom`
	 * is read by the editor scene, so committing each one would re-render the 3D
	 * view for every pixel of the drag. The atom is written once, on release —
	 * the same shape `shadow-settings-panel` uses for its sliders, and the one
	 * the hotspot gizmo itself landed on.
	 */
	const sequencedIds = useMemo(
		() => inSequence.map((hotspot) => hotspot.id),
		[inSequence]
	)
	const [draftOrder, setDraftOrder] = useState<string[]>(sequencedIds)
	const isDraggingRef = useRef(false)

	useEffect(() => {
		if (isDraggingRef.current) return
		setDraftOrder(sequencedIds)
	}, [sequencedIds])

	const commitOrder = useCallback(
		(order: string[], movedId: string, movedName: string) => {
			setHotspots((prev) => reorderSequence(prev, order))
			setAnnouncement(
				`${movedName} moved to step ${order.indexOf(movedId) + 1} of ${order.length}.`
			)
		},
		[setHotspots]
	)

	const handleReorderEnd = useCallback(
		(id: string, name: string) => {
			isDraggingRef.current = false
			commitOrder(draftOrder, id, name)
		},
		[commitOrder, draftOrder]
	)

	const handleKeyboardMove = useCallback(
		(id: string, name: string, delta: number | 'first' | 'last') => {
			const from = draftOrder.indexOf(id)
			if (from < 0) return

			const to =
				delta === 'first'
					? 0
					: delta === 'last'
						? draftOrder.length - 1
						: from + delta

			if (to < 0 || to >= draftOrder.length || to === from) return

			const next = [...draftOrder]
			next.splice(to, 0, ...next.splice(from, 1))
			setDraftOrder(next)
			commitOrder(next, id, name)
		},
		[commitOrder, draftOrder]
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

	/**
	 * Deleting renumbers what is left.
	 *
	 * Removing step 2 of 3 used to leave indices 0 and 2. That was invisible
	 * while a number field owned the display; now that the list *is* the order,
	 * a gap would show as steps 1 and 3 with nothing between them.
	 */
	const handleDelete = useCallback(
		(id: string) => {
			const next = removeHotspot({ camera, hotspots }, id)
			const survivingOrder = sequencedFirst(next.hotspots).inSequence.map(
				(hotspot) => hotspot.id
			)

			setHotspots(reorderSequence(next.hotspots, survivingOrder))
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

	const handleMembershipChange = useCallback(
		(id: string, memberOfSequence: boolean) => {
			setHotspots((prev) => setSequenceMembership(prev, id, memberOfSequence))
		},
		[setHotspots]
	)

	const renderEditor = useCallback(
		(hotspot: HotspotDefinition) => (
			<>
				<InlineNotice tone={isClickToPlaceActive ? 'warning' : 'neutral'}>
					{isClickToPlaceActive
						? 'Click anywhere on the model to move this marker there.'
						: 'Drag the marker in the scene, or place it from here.'}
				</InlineNotice>

				<Button
					variant={isClickToPlaceActive ? 'secondary' : 'outline'}
					size="sm"
					aria-pressed={isClickToPlaceActive}
					onClick={() => setIsClickToPlaceActive((active) => !active)}
					className="publisher-shell-focus w-full gap-1.5"
				>
					<Crosshair
						aria-hidden
						className={cn(
							'size-3.5',
							isClickToPlaceActive && 'animate-pulse motion-reduce:animate-none'
						)}
					/>
					{isClickToPlaceActive ? 'Click the model…' : 'Place on model'}
				</Button>

				<SettingGroup label="Position">
					<div className="grid grid-cols-3 gap-1.5">
						{AXES.map((axis, index) => (
							<AxisField
								key={axis}
								axis={axis}
								value={hotspot.worldPosition[index]}
								onChange={(raw) =>
									handlePositionChange(index as 0 | 1 | 2, raw)
								}
							/>
						))}
					</div>
				</SettingGroup>

				<SettingGroup label="Name">
					<Input
						aria-label="Marker name"
						value={hotspot.name}
						onChange={(event) => handleRename(hotspot.id, event.target.value)}
						placeholder="Hotspot name"
						className="text-sm"
					/>
				</SettingGroup>

				<SettingGroup label="Style">
					<ToggleButtonGroup
						options={STYLE_PRESET_OPTIONS}
						value={hotspot.stylePreset}
						onChange={(preset) =>
							updateHotspot(hotspot.id, { stylePreset: preset })
						}
					/>
				</SettingGroup>

				<AnimatePresence initial={false}>
					{hotspot.stylePreset !== 'dot' && (
						<motion.div
							key="payload-url"
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: 'auto', opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: reduceMotion ? 0 : 0.15 }}
							className="overflow-hidden"
						>
							<SettingGroup label="Asset URL">
								<Input
									aria-label="Asset URL"
									value={hotspot.payloadUrl ?? ''}
									onChange={(event) =>
										updateHotspot(hotspot.id, {
											payloadUrl: event.target.value || undefined
										})
									}
									placeholder="https://…"
									className="text-sm"
								/>
							</SettingGroup>
						</motion.div>
					)}
				</AnimatePresence>

				<SettingGroup
					label="Linked camera"
					description="Viewers transition to this camera when they click the marker."
				>
					<Select
						value={hotspot.linkedCameraId ?? 'none'}
						onValueChange={(value) =>
							handleRelink(hotspot.id, value === 'none' ? undefined : value)
						}
					>
						<SelectTrigger aria-label="Linked camera" className="w-full">
							<SelectValue placeholder="None" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">None</SelectItem>
							{allCameras.map((entry) => (
								<SelectItem key={entry.cameraId} value={entry.cameraId}>
									{entry.name || entry.cameraId}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</SettingGroup>

				<SettingToggle
					enabled={hotspot.sequenceIndex !== undefined}
					onToggle={(enabled) => handleMembershipChange(hotspot.id, enabled)}
					title="In the sequence"
					description="Include this marker in the order viewers step through."
				/>

				<SettingToggle
					enabled={hotspot.visible}
					onToggle={(enabled) =>
						updateHotspot(hotspot.id, { visible: enabled })
					}
					title="Visible to viewers"
					description="Show this marker in the published scene."
				/>

				<SettingToggle
					enabled={hotspot.internalOnly}
					onToggle={(enabled) =>
						updateHotspot(hotspot.id, { internalOnly: enabled })
					}
					title="Editor only"
					description="Keep the marker in the publisher and leave it out of the embed."
				/>

				<SettingToggle
					enabled={hotspot.occlusionEnabled ?? true}
					onToggle={(enabled) =>
						updateHotspot(hotspot.id, { occlusionEnabled: enabled })
					}
					title="Hide behind geometry"
					description="Fade the marker when part of the model is in front of it."
				/>
			</>
		),
		[
			allCameras,
			handleMembershipChange,
			handlePositionChange,
			handleRelink,
			handleRename,
			isClickToPlaceActive,
			reduceMotion,
			setIsClickToPlaceActive,
			updateHotspot
		]
	)

	if (hotspots.length === 0) {
		return (
			<Empty className="publisher-shell-nested gap-4 rounded-xl px-4 py-8">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Locate aria-hidden />
					</EmptyMedia>
					<EmptyTitle className="text-h4">No markers yet</EmptyTitle>
					<EmptyDescription>
						Add one, then click the model to place it.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						variant="outline"
						size="sm"
						onClick={handleAdd}
						className="gap-1.5"
					>
						<Plus aria-hidden className="size-3.5" />
						Add marker
					</Button>
				</EmptyContent>
			</Empty>
		)
	}

	const rowProps = (hotspot: HotspotDefinition) => ({
		hotspot,
		step: stepById.get(hotspot.id) ?? null,
		isOpen: selectedId === hotspot.id,
		reduceMotion,
		onOpenChange: (open: boolean) => setSelectedId(open ? hotspot.id : null),
		onDelete: () => handleDelete(hotspot.id)
	})

	return (
		<SidebarSection
			title="Markers"
			tooltip="Markers call out a point on the model. Drag one to set the order viewers step through; a marker without a number is not in that order."
			action={
				<Button
					variant="ghost"
					size="sm"
					onClick={handleAdd}
					className="publisher-shell-focus -my-1 h-7 gap-1.5 px-2"
				>
					<Plus aria-hidden className="size-3.5" />
					Add
				</Button>
			}
		>
			<SidebarSectionContent>
				<span role="status" aria-live="polite" className="sr-only">
					{announcement}
				</span>
				<p id="hotspot-reorder-hint" className="sr-only">
					Use the up and down arrow keys to move a marker through the sequence.
				</p>

				<div className="space-y-1">
					<p className="text-muted-foreground text-label-xs px-1">
						In the sequence
					</p>
					{inSequence.length === 0 ? (
						<p className="text-muted-foreground/75 text-label-xs px-1 pb-1">
							Turn on “In the sequence” for a marker below to add it.
						</p>
					) : (
						<Reorder.Group
							axis="y"
							role="list"
							values={draftOrder}
							onReorder={setDraftOrder}
							className="space-y-1"
						>
							{draftOrder.map((id) => {
								const hotspot = inSequence.find((entry) => entry.id === id)
								if (!hotspot) return null
								return (
									<SequencedRow
										key={id}
										id={id}
										onDragStart={() => {
											isDraggingRef.current = true
										}}
										onDragEnd={() =>
											handleReorderEnd(id, hotspot.name || 'Unnamed hotspot')
										}
										onMove={(delta) =>
											handleKeyboardMove(
												id,
												hotspot.name || 'Unnamed hotspot',
												delta
											)
										}
										{...rowProps(hotspot)}
									>
										{renderEditor(hotspot)}
									</SequencedRow>
								)
							})}
						</Reorder.Group>
					)}
				</div>

				{rest.length > 0 && (
					<div className="space-y-1">
						<p className="text-muted-foreground text-label-xs px-1">
							Not in the sequence
						</p>
						<ul role="list" className="space-y-1">
							{rest.map((hotspot) => (
								<li key={hotspot.id}>
									<HotspotRow {...rowProps(hotspot)}>
										{renderEditor(hotspot)}
									</HotspotRow>
								</li>
							))}
						</ul>
					</div>
				)}
			</SidebarSectionContent>
		</SidebarSection>
	)
})

HotspotsSettingsPanel.displayName = 'HotspotsSettingsPanel'

export default HotspotsSettingsPanel
