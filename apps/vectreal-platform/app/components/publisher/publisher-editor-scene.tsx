import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { PublisherViewCube } from './publisher-view-cube'
import { usePublisherViewerCapture } from './publisher-viewer-capture-context'
import {
	isHotspotPlacementGesture,
	prepareHotspotRaycaster,
	resolveHotspotAnchor
} from '../../lib/domain/scene/scene-hotspot-placement'
import {
	openComposeToolAtom,
	isClickToPlaceActiveAtom
} from '../../lib/stores/publisher-config-store'
import {
	activeHotspotIdAtom,
	hotspotsAtom
} from '../../lib/stores/scene-settings-store'

import type { HotspotDefinition } from '@vctrl/core'
import type { Object3D } from 'three'

// ---------------------------------------------------------------------------
// TransformControls gizmo for the active hotspot
// ---------------------------------------------------------------------------

interface HotspotGizmoProps {
	hotspot: HotspotDefinition
	/**
	 * Set when a press lands on a translate handle, so `ClickToPlace` can tell a
	 * gizmo nudge from a click on the model. three-stdlib stops neither the event
	 * nor its propagation, and a nudge shorter than the drag tolerance otherwise
	 * reads as a placement aimed at whatever the arrow tip covers.
	 */
	grabbedRef: React.MutableRefObject<boolean>
	onMove: (id: string, position: [number, number, number]) => void
}

const HotspotGizmo = memo(
	({ hotspot, grabbedRef, onMove }: HotspotGizmoProps) => {
		const meshRef = useRef<THREE.Mesh>(null)
		const isDraggingRef = useRef(false)
		/**
		 * The last position published to the viewer during the drag.
		 *
		 * The interrupted path cannot read the mesh: React detaches a callback ref in
		 * the mutation phase and the cleanup that finishes the drag runs in the
		 * passive phase after it, so `meshRef.current` is already null by then and the
		 * author's drag used to be discarded in silence.
		 */
		const lastPublished = useRef<[number, number, number] | null>(null)
		const { commandExecutor, hotspotPositionSetter } =
			usePublisherViewerCapture()
		// TransformControls `object` prop requires the mesh to already be in the scene
		const [meshMounted, setMeshMounted] = useState(false)

		/**
		 * Tells the viewer where this hotspot's marker should be drawn right now.
		 *
		 * The marker belongs to `@vctrl/viewer`, which draws every hotspot on every
		 * surface; the gizmo is all the publisher still owns. The viewer applies this
		 * to the marker's own anchor group inside a frame callback, so a drag never
		 * touches React state - which is what it cost when this component committed
		 * to `hotspotsAtom` on every frame instead: the settings object rebuilt from
		 * that atom is the memo key for the unsaved-changes check, so a drag ran two
		 * full canonical serializations of every scene setting twice per frame while
		 * every marker and the sidebar re-rendered.
		 */
		const publishDragPosition = useCallback(() => {
			const p = meshRef.current?.position
			if (!p) return
			lastPublished.current = [p.x, p.y, p.z]
			hotspotPositionSetter.current?.(hotspot.id, lastPublished.current)
		}, [hotspot.id, hotspotPositionSetter])

		/** Hands the marker back to its stored position. Commit before releasing. */
		const releaseDragPosition = useCallback(() => {
			hotspotPositionSetter.current?.(hotspot.id, null)
		}, [hotspot.id, hotspotPositionSetter])

		// Imperatively sync position when the atom changes (e.g. after click-to-place).
		// Guarded so we don't fight TransformControls while the user is dragging.
		useEffect(() => {
			if (meshRef.current && !isDraggingRef.current) {
				const [x, y, z] = hotspot.worldPosition
				meshRef.current.position.set(x, y, z)
			}
		}, [hotspot.worldPosition])

		const handleDragStart = useCallback(() => {
			isDraggingRef.current = true
			grabbedRef.current = true
			lastPublished.current = null
			// Published before the first `objectChange`. three-stdlib dispatches
			// `mouseDown` with no `objectChange` of its own - the first of those comes
			// from a pointermove, many frames later - so a marker whose override began
			// life empty would have nowhere to be drawn until the pointer moved.
			publishDragPosition()
			commandExecutor.current?.execute({
				type: 'set_controls_enabled',
				enabled: false
			})
		}, [commandExecutor, grabbedRef, publishDragPosition])

		const handleDragEnd = useCallback(() => {
			isDraggingRef.current = false
			commandExecutor.current?.execute({
				type: 'set_controls_enabled',
				enabled: true
			})
			if (meshRef.current) {
				const p = meshRef.current.position
				onMove(hotspot.id, [p.x, p.y, p.z])
			}
			// Release after the commit, in the same task. `setHotspots` schedules the
			// update rather than applying it, so the release still runs first in wall
			// time; what the ordering buys is that the commit is already queued when
			// the viewer sees the release, so the marker settles on the new position
			// rather than being put back on the old one.
			releaseDragPosition()
		}, [commandExecutor, hotspot.id, onMove, releaseDragPosition])

		const handleObjectChange = useCallback(() => {
			if (!meshRef.current || !isDraggingRef.current) return
			publishDragPosition()
		}, [publishDragPosition])

		/**
		 * Finishes a drag the gizmo is about to be torn away from.
		 *
		 * Switching compose tools unmounts the gizmo mid-drag, and only
		 * `handleDragEnd` commits the edit and turns orbiting back on. Without this
		 * the position lives in a mesh about to be discarded and the camera stays
		 * locked. While the drag committed on every frame neither mattered.
		 */
		const finishInterruptedDrag = useCallback(() => {
			if (!isDraggingRef.current) return
			isDraggingRef.current = false
			commandExecutor.current?.execute({
				type: 'set_controls_enabled',
				enabled: true
			})
			// The mesh first, then the last vector published to the viewer. Running as
			// an unmount cleanup the ref is already detached, and the fallback is the
			// difference between keeping the author's drag and throwing it away because
			// they switched tools without letting go.
			const p = meshRef.current?.position
			const position = p ? [p.x, p.y, p.z] : lastPublished.current
			if (position) {
				onMove(hotspot.id, [position[0], position[1], position[2]])
			}
			releaseDragPosition()
		}, [commandExecutor, hotspot.id, onMove, releaseDragPosition])

		/**
		 * Hands the gizmo the release it is waiting for when a gesture is cancelled.
		 *
		 * three-stdlib's `TransformControls` listens for `pointerup` on the document
		 * and does not listen for `pointercancel` at all, so a cancelled touch or
		 * pen gesture leaves it dragging: it clears that flag only inside its own
		 * `pointerUp`, and its document-level `pointermove` admits a buttonless
		 * move, so the mesh keeps translating under the bare cursor and the next
		 * click commits somewhere the author never dragged to.
		 *
		 * Replaying the release rather than writing its state directly, because its
		 * `pointerUp` is what drops the axis and fires `mouseUp` - and `mouseUp` is
		 * `handleDragEnd`, which already commits and re-enables orbiting. It takes
		 * no pointer capture, so nothing is left holding the pointer either.
		 */
		const handlePointerCancel = useCallback((event: PointerEvent) => {
			if (!isDraggingRef.current) return
			document.dispatchEvent(
				new PointerEvent('pointerup', {
					bubbles: true,
					button: 0,
					pointerId: event.pointerId,
					pointerType: event.pointerType
				})
			)
		}, [])

		useEffect(() => {
			window.addEventListener('pointercancel', handlePointerCancel)
			return () => {
				window.removeEventListener('pointercancel', handlePointerCancel)
				finishInterruptedDrag()
			}
		}, [finishInterruptedDrag, handlePointerCancel])

		return (
			<>
				<mesh
					ref={(node) => {
						;(meshRef as React.MutableRefObject<THREE.Mesh | null>).current =
							node
						if (node && !meshMounted) setMeshMounted(true)
					}}
					position={hotspot.worldPosition as [number, number, number]}
				>
					<sphereGeometry args={[0.001, 1, 1]} />
					<meshBasicMaterial visible={false} />
				</mesh>

				{meshMounted && meshRef.current && (
					<TransformControls
						object={meshRef.current}
						mode="translate"
						onMouseDown={handleDragStart}
						onMouseUp={handleDragEnd}
						onObjectChange={handleObjectChange}
					/>
				)}
			</>
		)
	}
)
HotspotGizmo.displayName = 'HotspotGizmo'

// ---------------------------------------------------------------------------
// Click-to-place interceptor
// ---------------------------------------------------------------------------

interface ClickToPlaceProps {
	isActive: boolean
	activeHotspotId: string | null
	modelRoot: Object3D | null
	gizmoGrabbedRef: React.MutableRefObject<boolean>
	onPlace: (id: string, position: [number, number, number]) => void
}

/**
 * Places the armed hotspot where a click lands on the model.
 *
 * The gesture is resolved on pointerup rather than pointerdown because
 * OrbitControls shares this canvas: a press is only a placement once it has
 * ended without having turned into an orbit.
 *
 * The release is read off the window rather than the canvas: a drag that ends
 * outside it still reports, and correctly fails the distance test rather than
 * leaving the press half-open. Nothing here captures the pointer, so nothing
 * can be released out from under a co-tenant mid-drag.
 */
function ClickToPlace({
	isActive,
	activeHotspotId,
	modelRoot,
	gizmoGrabbedRef,
	onPlace
}: ClickToPlaceProps) {
	const { camera, gl } = useThree()
	const placementRay = useMemo(
		() => prepareHotspotRaycaster(new THREE.Raycaster()),
		[]
	)

	useEffect(() => {
		if (!isActive || !activeHotspotId) return

		const canvas = gl.domElement
		let pressed: { button: number; x: number; y: number } | null = null
		// The gizmo outlives this effect: it stays mounted while the tool is
		// disarmed, which is exactly where auto-disarm leaves the author after every
		// placement. A grab recorded back then would be consumed by the first click
		// of the next armed session, silently swallowing it.
		gizmoGrabbedRef.current = false

		const handlePointerDown = (event: PointerEvent) => {
			pressed = { button: event.button, x: event.clientX, y: event.clientY }
		}

		const handlePointerUp = (event: PointerEvent) => {
			const down = pressed
			pressed = null
			// Consumed here rather than cleared on the next press: the gizmo and this
			// handler both listen on the canvas, and their registration order is not
			// ours to decide.
			const grabbedGizmo = gizmoGrabbedRef.current
			gizmoGrabbedRef.current = false
			if (!down) return

			const isPlacement = isHotspotPlacementGesture({
				button: down.button,
				downX: down.x,
				downY: down.y,
				upX: event.clientX,
				upY: event.clientY,
				grabbedGizmo
			})
			if (!isPlacement) return

			const rect = canvas.getBoundingClientRect()
			placementRay.setFromCamera(
				new THREE.Vector2(
					((event.clientX - rect.left) / rect.width) * 2 - 1,
					-((event.clientY - rect.top) / rect.height) * 2 + 1
				),
				camera
			)

			const anchor = resolveHotspotAnchor(placementRay, modelRoot)
			if (anchor) onPlace(activeHotspotId, anchor)
		}

		const handlePointerCancel = () => {
			pressed = null
			gizmoGrabbedRef.current = false
		}

		canvas.addEventListener('pointerdown', handlePointerDown)
		window.addEventListener('pointerup', handlePointerUp)
		window.addEventListener('pointercancel', handlePointerCancel)
		return () => {
			canvas.removeEventListener('pointerdown', handlePointerDown)
			window.removeEventListener('pointerup', handlePointerUp)
			window.removeEventListener('pointercancel', handlePointerCancel)
		}
	}, [
		isActive,
		activeHotspotId,
		camera,
		gizmoGrabbedRef,
		gl,
		modelRoot,
		onPlace
	])

	return null
}

// ---------------------------------------------------------------------------
// Main editor scene
// ---------------------------------------------------------------------------

/**
 * What the publisher adds on top of the viewer, and nothing more.
 *
 * The markers themselves belong to `@vctrl/viewer`: the route passes the scene's
 * hotspots straight through, so an author composes against exactly the marker a
 * visitor will see. This component owns only the affordances that make no sense
 * outside an editor - the transform gizmo, click-to-place, and getting the view
 * cube out of the way while placement is armed.
 */
export const PublisherEditorScene = memo(() => {
	const [hotspots, setHotspots] = useAtom(hotspotsAtom)
	const activeHotspotId = useAtomValue(activeHotspotIdAtom)
	const [isClickToPlaceActive, setIsClickToPlaceActive] = useAtom(
		isClickToPlaceActiveAtom
	)
	const openComposeTool = useAtomValue(openComposeToolAtom)
	// The tool whose panel is open, never the one merely selected: closing the
	// drawer has to take the gizmo and click-to-place with it.
	const isHotspotToolActive = openComposeTool === 'hotspots'
	const isPlacementArmed = isClickToPlaceActive && isHotspotToolActive
	// The object the viewer renders, and the only thing a hotspot anchors to.
	const { file } = useModelContext()
	const modelRoot = file?.model ?? null
	const gizmoGrabbedRef = useRef(false)

	const handleMoveHotspot = useCallback(
		(id: string, position: [number, number, number]) => {
			setHotspots((prev) =>
				prev.map((h) => (h.id === id ? { ...h, worldPosition: position } : h))
			)
		},
		[setHotspots]
	)

	/**
	 * Disarms on success. Placing is one deliberate act, and leaving the tool
	 * armed meant every later click on the canvas moved the hotspot again -
	 * including clicks the author made to orbit or to pick a different one.
	 */
	const handlePlaceHotspot = useCallback(
		(id: string, position: [number, number, number]) => {
			setHotspots((prev) =>
				prev.map((h) => (h.id === id ? { ...h, worldPosition: position } : h))
			)
			setIsClickToPlaceActive(false)
		},
		[setHotspots, setIsClickToPlaceActive]
	)

	const activeHotspot = hotspots.find((h) => h.id === activeHotspotId) ?? null

	return (
		<>
			{isHotspotToolActive && activeHotspot && (
				<HotspotGizmo
					key={activeHotspot.id}
					hotspot={activeHotspot}
					grabbedRef={gizmoGrabbedRef}
					onMove={handleMoveHotspot}
				/>
			)}

			<ClickToPlace
				isActive={isPlacementArmed}
				activeHotspotId={activeHotspotId}
				modelRoot={modelRoot}
				gizmoGrabbedRef={gizmoGrabbedRef}
				onPlace={handlePlaceHotspot}
			/>

			{/*
			 * Withdrawn while a placement is armed. drei's GizmoViewcube guards its
			 * faces with R3F's `stopPropagation`, which halts R3F's own traversal
			 * and never touches the native event, so the cube cannot stop the
			 * native listener above from reading a click on it as a placement -
			 * relocating the hotspot to whatever geometry sits behind that corner
			 * and disarming, so the affordance vanishes in the same moment. Taking
			 * the cube off screen removes the overlap rather than guarding it.
			 */}
			{!isPlacementArmed && <PublisherViewCube />}
		</>
	)
})
PublisherEditorScene.displayName = 'PublisherEditorScene'
