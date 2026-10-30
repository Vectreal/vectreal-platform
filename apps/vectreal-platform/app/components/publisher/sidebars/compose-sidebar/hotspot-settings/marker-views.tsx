import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Textarea } from '@shared/components/ui/textarea'
import { Toggle } from '@shared/components/ui/toggle'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { describeAnimationClips } from '@vctrl/core'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import {
	ArrowUpRight,
	Crosshair,
	Eye,
	ListOrdered,
	Move3d,
	Palette,
	SquarePen,
	Type
} from 'lucide-react'
import { useEffect, useMemo } from 'react'

import { AXES, AxisField } from './axis-field'
import { MarkerArtworkField } from './marker-artwork-field'
import {
	describeOcclusionBehavior,
	OCCLUSION_VISIBILITY_OPTIONS,
	occlusionBehaviorOf,
	occlusionPatch
} from './occlusion-behavior'
import { useHotspotEdits } from './use-hotspot-edits'
import {
	isAllowedHotspotLinkUrl,
	MAX_HOTSPOT_BODY_LENGTH
} from '../../../../../lib/domain/scene/hotspot-urls'
import { clipLabel } from '../../../../../lib/domain/scene/scene-animation-draft'
import {
	isClickToPlaceActiveAtom,
	openCameraInCameraToolAtom
} from '../../../../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	heldHotspotCardIdAtom
} from '../../../../../lib/stores/scene-settings-store'
import { InlineNotice } from '../../../../layout-components'
import { DrillDownTrigger } from '../../drill-down'
import { useSidebarCoversCanvas } from '../../dynamic-sidebar'
import { SettingGroup } from '../../sidebar-section'
import { useModelClips } from '../animation-settings/use-animation-reconciliation'

import type { HotspotDefinition, HotspotStylePreset } from '@vctrl/core'

/*
  The views below the marker list. Each takes the marker it edits rather than
  reading the selection, like the edits themselves, so a view still sliding out
  after the selection moved cannot write to the marker that replaced it.
*/

interface MarkerViewProps {
	hotspot: HotspotDefinition
}

const STYLE_PRESET_OPTIONS: { value: HotspotStylePreset; label: string }[] = [
	{ value: 'dot', label: 'Dot' },
	{ value: 'image', label: 'Image' },
	{ value: 'svg', label: 'SVG' }
]

/** A marker's top level: how it behaves, its camera, and its groups. */
export function MarkerOverview({ hotspot }: MarkerViewProps) {
	const edits = useHotspotEdits()
	const { cameras = [] } = useAtomValue(cameraAtom)
	const openCameraInCameraTool = useSetAtom(openCameraInCameraToolAtom)
	const linkedCamera = cameras.find(
		(entry) => entry.cameraId === hotspot.linkedCameraId
	)
	const [isClickToPlaceActive, setIsClickToPlaceActive] = useAtom(
		isClickToPlaceActiveAtom
	)
	// In the mobile sheet the canvas is out of reach, so placing on the model
	// is neither offered nor described: the coordinates are how it moves.
	const coversCanvas = useSidebarCoversCanvas()
	const occlusionBehavior = occlusionBehaviorOf(hotspot)
	const styleLabel = STYLE_PRESET_OPTIONS.find(
		(option) => option.value === hotspot.stylePreset
	)?.label

	return (
		<>
			<InlineNotice tone={isClickToPlaceActive ? 'warning' : 'neutral'}>
				{coversCanvas
					? 'Set where the marker sits under Position. Placing it on the model needs a wider screen.'
					: isClickToPlaceActive
						? 'Click anywhere on the model to move this marker there.'
						: 'Drag the marker in the scene, or place it from here.'}
			</InlineNotice>

			<div className="grid grid-cols-3 gap-2">
				{!coversCanvas && (
					<Toggle
						layout="tile"
						label="Place on model"
						icon={<Crosshair />}
						checked={isClickToPlaceActive}
						onCheckedChange={setIsClickToPlaceActive}
					/>
				)}
				<Toggle
					layout="tile"
					label="In sequence"
					icon={<ListOrdered />}
					checked={hotspot.sequenceIndex !== undefined}
					onCheckedChange={(enabled) =>
						edits.setMembership(hotspot.id, enabled)
					}
				/>
				<Toggle
					layout="tile"
					label="Visible"
					icon={<Eye />}
					checked={hotspot.visible}
					onCheckedChange={(enabled) =>
						edits.update(hotspot.id, { visible: enabled })
					}
				/>
				<Toggle
					layout="tile"
					label="Editor only"
					icon={<SquarePen />}
					checked={hotspot.internalOnly}
					onCheckedChange={(enabled) =>
						edits.update(hotspot.id, { internalOnly: enabled })
					}
				/>
			</div>

			<SettingGroup
				label="Behind the model"
				description={describeOcclusionBehavior(
					occlusionBehavior,
					!!linkedCamera
				)}
			>
				<ToggleGroup
					type="single"
					aria-label="Behind the model"
					value={occlusionBehavior === 'show' ? 'show' : 'fade'}
					onValueChange={(value) => {
						// Clicking the active item again deselects it with ''. Fade from
						// Show starts inert, the viewer's default.
						if (value === 'show' || value === 'fade') {
							edits.update(hotspot.id, occlusionPatch(value))
						}
					}}
				>
					{OCCLUSION_VISIBILITY_OPTIONS.map((option) => (
						<ToggleGroupItem key={option.value} value={option.value}>
							{option.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				{occlusionBehavior !== 'show' && (
					<Toggle
						layout="row"
						label="Clickable while faded"
						checked={occlusionBehavior === 'fade_clickable'}
						onCheckedChange={(clickable) =>
							edits.update(
								hotspot.id,
								occlusionPatch(clickable ? 'fade_clickable' : 'fade')
							)
						}
						className="pt-1"
					/>
				)}
			</SettingGroup>

			<SettingGroup
				label="Linked camera"
				description="Viewers transition to this camera when they click the marker."
				action={
					linkedCamera && (
						// The camera is edited in the Camera tool, where cameras are.
						<Button
							variant="ghost"
							size="sm"
							onClick={() => openCameraInCameraTool(linkedCamera.cameraId)}
							className="shell-focus -my-1 h-7 gap-1.5 px-2"
						>
							Open in Camera tool
							<ArrowUpRight aria-hidden className="size-3.5" />
						</Button>
					)
				}
			>
				<Select
					value={hotspot.linkedCameraId ?? 'none'}
					onValueChange={(value) =>
						edits.relink(hotspot.id, value === 'none' ? undefined : value)
					}
				>
					<SelectTrigger aria-label="Linked camera" className="w-full min-w-0">
						<SelectValue placeholder="None" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">None</SelectItem>
						{cameras.map((entry) => (
							<SelectItem key={entry.cameraId} value={entry.cameraId}>
								<span className="truncate">{entry.name || entry.cameraId}</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingGroup>

			<LinkedAnimationField hotspot={hotspot} />

			<div className="space-y-2">
				<DrillDownTrigger
					to="content"
					icon={<Type />}
					label="Content"
					summary={hotspot.linkUrl ? 'With link' : undefined}
				/>
				<DrillDownTrigger
					to="appearance"
					icon={<Palette />}
					label="Appearance"
					summary={styleLabel}
				/>
				<DrillDownTrigger
					to="position"
					icon={<Move3d />}
					label="Position"
					summary={hotspot.worldPosition
						.map((axis) => axis.toFixed(1))
						.join(', ')}
				/>
			</div>
		</>
	)
}

/** Value of the "no clip" option; never a clip id, which is never empty. */
const NO_CLIP = 'none'

/**
 * The clip that plays once, holding its last frame, when a visitor clicks the
 * marker. Not offered on a model with no clips.
 *
 * A saved link naming a clip the model no longer has stays selected under a
 * label that says so, rather than reading as "None": the link is still saved,
 * and the author should see why the marker plays nothing.
 */
function LinkedAnimationField({ hotspot }: MarkerViewProps) {
	const edits = useHotspotEdits()
	const clips = useModelClips()
	const descriptors = useMemo(() => describeAnimationClips(clips), [clips])
	if (descriptors.length === 0) return null

	const linkedClipId = hotspot.linkedAnimationClipId
	const isMissing =
		!!linkedClipId &&
		!descriptors.some((descriptor) => descriptor.clipId === linkedClipId)

	return (
		<SettingGroup
			label="Linked animation"
			description="Plays once when viewers click the marker, and holds its last frame."
		>
			<Select
				value={linkedClipId ?? NO_CLIP}
				onValueChange={(value) =>
					edits.update(hotspot.id, {
						linkedAnimationClipId: value === NO_CLIP ? undefined : value
					})
				}
			>
				<SelectTrigger aria-label="Linked animation" className="w-full min-w-0">
					<SelectValue placeholder="None" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NO_CLIP}>None</SelectItem>
					{isMissing && (
						<SelectItem value={linkedClipId} disabled>
							Clip no longer in model
						</SelectItem>
					)}
					{descriptors.map((descriptor) => (
						<SelectItem key={descriptor.clipId} value={descriptor.clipId}>
							<span className="truncate">{clipLabel(descriptor)}</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</SettingGroup>
	)
}

/**
 * Holds this hotspot's card open on the canvas while its Content view is on
 * screen, so the author sees the card they are writing.
 *
 * The drill-down mounts only its active view, so mounted is exactly "open":
 * going back, switching tools and entering preview all unmount it, and the
 * card closes once the view has slid out.
 */
function useHoldHotspotCard(hotspotId: string) {
	const setHeld = useSetAtom(heldHotspotCardIdAtom)

	useEffect(() => {
		setHeld(hotspotId)
		return () => setHeld(null)
	}, [hotspotId, setHeld])
}

/** What a visitor reads when they open the marker. */
export function MarkerContent({ hotspot }: MarkerViewProps) {
	useHoldHotspotCard(hotspot.id)
	const edits = useHotspotEdits()
	const linkErrorId = `hotspot-link-error-${hotspot.id}`
	// An empty field is not an invalid one: clearing the link is how an author
	// removes it.
	const linkIsInvalid =
		!!hotspot.linkUrl && !isAllowedHotspotLinkUrl(hotspot.linkUrl)

	return (
		<>
			<SettingGroup label="Name">
				<Input
					aria-label="Marker name"
					value={hotspot.name}
					onChange={(event) => edits.rename(hotspot.id, event.target.value)}
					placeholder="Hotspot name"
					className="text-sm"
				/>
			</SettingGroup>

			<SettingGroup label="Body">
				<Textarea
					aria-label="Marker body"
					value={hotspot.body ?? ''}
					onChange={(event) =>
						edits.update(hotspot.id, {
							body: event.target.value || undefined
						})
					}
					// The save parser refuses a longer body, and a refusal there
					// fails the whole scene with a message naming an array index.
					// The field is the only place an author sees the limit at the
					// moment it applies.
					maxLength={MAX_HOTSPOT_BODY_LENGTH}
					placeholder="What is a visitor looking at?"
					className="min-h-20 text-sm"
				/>
			</SettingGroup>

			<SettingGroup label="Link">
				<Input
					aria-label="Marker link"
					type="url"
					value={hotspot.linkUrl ?? ''}
					onChange={(event) =>
						edits.update(hotspot.id, {
							linkUrl: event.target.value || undefined
						})
					}
					aria-invalid={linkIsInvalid || undefined}
					aria-describedby={linkIsInvalid ? linkErrorId : undefined}
					placeholder="https://…"
					className="text-sm"
				/>
				{linkIsInvalid && (
					// Said beside the field rather than left to the save, which
					// answers a bad link by refusing the entire scene with a
					// message naming an array index - neither the marker nor the
					// field the author is looking at.
					<p id={linkErrorId} className="text-destructive text-xs">
						Links must start with https://
					</p>
				)}
			</SettingGroup>
		</>
	)
}

/** The marker's look: a dot, or an uploaded image or SVG. */
export function MarkerAppearance({ hotspot }: MarkerViewProps) {
	const edits = useHotspotEdits()

	return (
		<>
			<ToggleGroup
				type="single"
				aria-label="Marker style"
				value={hotspot.stylePreset}
				onValueChange={(preset) => {
					if (preset) {
						edits.update(hotspot.id, {
							stylePreset: preset as HotspotStylePreset
						})
					}
				}}
			>
				{STYLE_PRESET_OPTIONS.map((option) => (
					<ToggleGroupItem key={option.value} value={option.value}>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>

			{hotspot.stylePreset !== 'dot' && (
				<MarkerArtworkField hotspot={hotspot} />
			)}
		</>
	)
}

/** World coordinates, typed. */
export function MarkerPosition({ hotspot }: MarkerViewProps) {
	const edits = useHotspotEdits()

	return (
		<div className="grid grid-cols-3 gap-1.5">
			{AXES.map((axis, index) => (
				<AxisField
					key={axis}
					axis={axis}
					value={hotspot.worldPosition[index]}
					onChange={(raw) => edits.setAxis(hotspot, index as 0 | 1 | 2, raw)}
				/>
			))}
		</div>
	)
}
