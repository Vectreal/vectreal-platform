import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { applyHotspotPlacement } from '../../lib/domain/scene/client/apply-hotspot-placement'
import {
	isHotspotPlacementGesture,
	prepareHotspotRaycaster,
	resolveHotspotAnchor
} from '../../lib/domain/scene/scene-hotspot-placement'
import {
	openComposeToolAtom,
	isClickToPlaceActiveAtom,
	viewArrivalsAtom,
	viewLensAtom,
	viewMovedAtom
} from '../../lib/stores/publisher-config-store'
import {
	activeHotspotIdAtom,
	hotspotsAtom
} from '../../lib/stores/scene-settings-store'
import { PublisherViewCube } from './publisher-view-cube'
import { usePublisherViewerCapture } from './publisher-viewer-capture-context'

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
		onPlace,
		placementRay
	])

	return null
}

// ---------------------------------------------------------------------------
// The editor view
// ---------------------------------------------------------------------------

/** Outlasts the viewer's double-click focus flight (`FOCUS_FLIGHT_MS`). */
const FOCUS_INPUT_MS = 1000
/** Two touches closer than this are a double-tap, as the viewer reads them. */
const DOUBLE_TAP_MS = 300

/**
 * Notes when the author moves the view off the camera it last went to, and
 * gives a moved view the lens the author is trying out.
 *
 * Moved means the camera changed (OrbitControls' `change`) while the author's
 * own input was under way: a press on the canvas until it is released, a wheel
 * turn or a key aimed at the viewer for one frame, a double-click or
 * double-tap focus for its flight. A press that turns nothing moves nothing, and a flight or a
 * framing changes the camera with no input under way. Arriving at a camera
 * ends whatever input set it off (Home, Enter on Back to camera, a
 * double-click on the background), so the flight there does not count. The
 * view cube (`onTurn` on `PublisherViewCube`) is the author's too.
 */
export function EditorViewTracker() {
	const camera = useThree((state) => state.camera)
	const controls = useThree((state) => state.controls) as null | {
		addEventListener: (type: 'change', listener: () => void) => void
		removeEventListener: (type: 'change', listener: () => void) => void
	}
	const canvas = useThree((state) => state.gl.domElement)
	const invalidate = useThree((state) => state.invalidate)
	const setViewMoved = useSetAtom(viewMovedAtom)
	const viewLens = useAtomValue(viewLensAtom)
	const viewLensRef = useRef(viewLens)
	viewLensRef.current = viewLens

	const store = useStore()

	useEffect(() => {
		let pressed = false
		let brief = false
		let focusing = false
		let briefFrame = 0
		let focusTimer: ReturnType<typeof setTimeout> | undefined
		const endInput = () => {
			brief = false
			focusing = false
			cancelAnimationFrame(briefFrame)
			clearTimeout(focusTimer)
		}
		const press = () => {
			pressed = true
		}
		// The viewer focuses on a double-tap from its own pointerup, after this
		// one, so a quick second touch opens the focus window first.
		let lastTouchUp = 0
		const release = (event: PointerEvent) => {
			pressed = false
			if (event.pointerType !== 'touch' || event.target !== canvas) return
			if (event.timeStamp - lastTouchUp <= DOUBLE_TAP_MS) openFocus()
			lastTouchUp = event.timeStamp
		}
		// A wheel turn or a key moves the camera in its own handler, so the
		// input stays under way until the next frame. Keys count only when
		// aimed at the viewer, whose element holds the canvas.
		const nudge = (event: Event) => {
			const target = event.target
			if (
				event.type === 'keydown' &&
				!(
					target instanceof Element &&
					target !== document.body &&
					target !== document.documentElement &&
					target.contains(canvas)
				)
			) {
				return
			}
			brief = true
			cancelAnimationFrame(briefFrame)
			briefFrame = requestAnimationFrame(() => {
				brief = false
			})
		}
		// A double-click on the model focuses it with a short flight, or at once
		// under reduced motion; on the background it sends the view home, an
		// arrival that ends the window within the same event. Opened in the
		// capture phase, so it is open before the viewer acts on the click.
		const openFocus = () => {
			focusing = true
			clearTimeout(focusTimer)
			focusTimer = setTimeout(() => {
				focusing = false
			}, FOCUS_INPUT_MS)
		}
		const changed = () => {
			if (pressed || brief || focusing) setViewMoved(true)
			// A flight carries the lens it started with; a moved view keeps the
			// one the author is trying out.
			const lens = viewLensRef.current
			if (
				lens !== null &&
				camera instanceof THREE.PerspectiveCamera &&
				camera.fov !== lens
			) {
				camera.fov = lens
				camera.updateProjectionMatrix()
			}
		}

		const unsubscribe = store.sub(viewArrivalsAtom, endInput)
		canvas.addEventListener('pointerdown', press, true)
		window.addEventListener('pointerup', release, true)
		window.addEventListener('pointercancel', release, true)
		canvas.addEventListener('wheel', nudge, { capture: true, passive: true })
		window.addEventListener('keydown', nudge, true)
		canvas.addEventListener('dblclick', openFocus, true)
		controls?.addEventListener('change', changed)
		return () => {
			endInput()
			unsubscribe()
			canvas.removeEventListener('pointerdown', press, true)
			window.removeEventListener('pointerup', release, true)
			window.removeEventListener('pointercancel', release, true)
			canvas.removeEventListener('wheel', nudge, true)
			window.removeEventListener('keydown', nudge, true)
			canvas.removeEventListener('dblclick', openFocus, true)
			controls?.removeEventListener('change', changed)
		}
	}, [camera, canvas, controls, setViewMoved, store])

	useEffect(() => {
		if (viewLens === null || !(camera instanceof THREE.PerspectiveCamera)) {
			return
		}
		camera.fov = viewLens
		camera.updateProjectionMatrix()
		invalidate()
	}, [camera, invalidate, viewLens])

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
	// Read for rendering; every write goes through the store below, so the pair
	// of atoms a placement touches stays one edit.
	const hotspots = useAtomValue(hotspotsAtom)
	const activeHotspotId = useAtomValue(activeHotspotIdAtom)
	const [isClickToPlaceActive, setIsClickToPlaceActive] = useAtom(
		isClickToPlaceActiveAtom
	)
	const setViewMoved = useSetAtom(viewMovedAtom)
	const markViewMoved = useCallback(() => setViewMoved(true), [setViewMoved])
	const openComposeTool = useAtomValue(openComposeToolAtom)
	// The tool whose panel is open, never the one merely selected: closing the
	// drawer has to take the gizmo and click-to-place with it.
	const isHotspotToolActive = openComposeTool === 'hotspots'
	const isPlacementArmed = isClickToPlaceActive && isHotspotToolActive
	// The object the viewer renders, and the only thing a hotspot anchors to.
	const { file } = useModelContext()
	const modelRoot = file?.model ?? null
	const gizmoGrabbedRef = useRef(false)
	/*
	  The edit needs both atoms at once - which camera a hotspot owns is a fact
	  about the two together - and this callback has to keep a stable identity:
	  it reaches `HotspotGizmo` as `onMove`, whose unmount cleanup commits an
	  interrupted drag, so a new identity mid-drag would re-run that effect and
	  commit the drag out from under the author. Reading through the store keeps
	  both properties; putting `hotspots` in the dependency list would lose the
	  second.
	*/
	const store = useStore()

	/**
	 * Both ways of placing a marker go through here, because both are the author
	 * saying where the point of interest is, and the camera the hotspot owns has
	 * to end up looking at it either way. `placeHotspot` owns that pairing so
	 * neither this file nor the sidebar has to know the ownership rule.
	 */
	const handleMoveHotspot = useCallback(
		(id: string, position: [number, number, number]) => {
			applyHotspotPlacement(store, id, position)
		},
		[store]
	)

	/**
	 * Disarms on success. Placing is one deliberate act, and leaving the tool
	 * armed meant every later click on the canvas moved the hotspot again -
	 * including clicks the author made to orbit or to pick a different one.
	 */
	const handlePlaceHotspot = useCallback(
		(id: string, position: [number, number, number]) => {
			handleMoveHotspot(id, position)
			setIsClickToPlaceActive(false)
		},
		[handleMoveHotspot, setIsClickToPlaceActive]
	)

	const activeHotspot = hotspots.find((h) => h.id === activeHotspotId) ?? null

	return (
		<>
			<EditorViewTracker />

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
			{!isPlacementArmed && <PublisherViewCube onTurn={markViewMoved} />}
		</>
	)
})
PublisherEditorScene.displayName = 'PublisherEditorScene'
