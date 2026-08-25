import { Html, TransformControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FC
} from 'react'
import * as THREE from 'three'

import { PublisherViewCube } from './publisher-view-cube'
import { usePublisherViewerCapture } from './publisher-viewer-capture-context'
import {
	isHotspotOccluded,
	isHotspotPlacementGesture,
	prepareHotspotRaycaster,
	resolveHotspotAnchor,
	resolveHotspotOcclusionTolerance
} from '../../lib/domain/scene/scene-hotspot-placement'
import {
	isClickToPlaceActiveAtom,
	processAtom
} from '../../lib/stores/publisher-config-store'
import {
	activeHotspotIdAtom,
	hotspotsAtom,
	normalizationAtom,
	selectedCameraIdAtom
} from '../../lib/stores/scene-settings-store'

import type { HotspotDefinition } from '@vctrl/core'
import type { Object3D } from 'three'

// ---------------------------------------------------------------------------
// Inject CSS keyframes for the pulsing dot animation (once per document)
// ---------------------------------------------------------------------------

function useHotspotStyles() {
	useEffect(() => {
		const id = 'vctrl-hotspot-styles'
		if (document.getElementById(id)) return
		const el = document.createElement('style')
		el.id = id
		el.textContent = `
      @keyframes vctrl-hotspot-pulse {
        0%   { box-shadow: 0 0 0 0px currentColor; }
        55%  { box-shadow: 0 0 0 8px transparent; }
        100% { box-shadow: 0 0 0 0px transparent; }
      }
      .vctrl-hp          { animation: vctrl-hotspot-pulse 2.2s ease-out infinite; }
      .vctrl-hp-selected { animation: vctrl-hotspot-pulse 1.3s ease-out infinite; }
    `
		document.head.appendChild(el)
	}, [])
}

/**
 * The gizmo's live position during a drag, shared with the marker that follows
 * it.
 *
 * Refs rather than state on purpose: a drag emits a position every frame, and
 * routing that through React is what this exists to stop.
 */
interface HotspotDragState {
	hotspotId: React.MutableRefObject<null | string>
	position: React.MutableRefObject<THREE.Vector3>
}

// ---------------------------------------------------------------------------
// 2-D hotspot dot rendered via drei Html (no 3-D geometry)
// ---------------------------------------------------------------------------

interface HotspotDotProps {
	hotspot: HotspotDefinition
	isSelected: boolean
	isHotspotToolActive: boolean
	activeCameraId?: string
	modelRoot: Object3D | null
	/**
	 * World-unit occlusion slack for this model, held by the owner and refreshed
	 * when the model or its transform changes.
	 */
	occlusionTolerance: React.MutableRefObject<number>
	/**
	 * Where the gizmo is while a drag is in flight, and whose drag it is. The
	 * dragged marker reads this instead of its stored position, so the drag can
	 * keep the marker glued to the gizmo without writing the scene settings on
	 * every frame.
	 */
	drag: HotspotDragState
	onSelect: (id: string) => void
	onActivateCamera: (cameraId: string) => void
}

const HotspotDot: FC<HotspotDotProps> = memo(
	({
		hotspot,
		isSelected,
		isHotspotToolActive,
		activeCameraId,
		modelRoot,
		occlusionTolerance,
		drag,
		onSelect,
		onActivateCamera
	}) => {
		const [hovered, setHovered] = useState(false)
		const wrapperRef = useRef<HTMLDivElement>(null)
		const anchorRef = useRef<THREE.Group>(null)
		const posVec = useRef(new THREE.Vector3(...hotspot.worldPosition))
		const { camera } = useThree()
		// Private, so the per-frame occlusion test cannot leave R3F's own pointer
		// raycaster aimed at a hotspot.
		const occlusionRay = useMemo(
			() => prepareHotspotRaycaster(new THREE.Raycaster()),
			[]
		)
		const occlusionDir = useRef(new THREE.Vector3())

		// Keep position in sync with atom changes (e.g. after gizmo drag or click-to-place)
		useEffect(() => {
			posVec.current.set(...hotspot.worldPosition)
			anchorRef.current?.position.copy(posVec.current)
		}, [hotspot.worldPosition])

		// Occlusion: raycast from camera toward hotspot every frame, mutate opacity
		// directly. Priority -1 so this writes the group's position before drei's
		// `Html` projects from it: at equal priority `Html` subscribes first, being
		// a child, and the marker would trail the gizmo by a frame. Negative
		// priorities sort early without taking rendering over, which only `> 0` does.
		useFrame(() => {
			// A drag moves the gizmo directly and commits once, on release, so the
			// dragged marker tracks the gizmo from here rather than from a stored
			// position that is deliberately not being rewritten yet.
			if (drag.hotspotId.current === hotspot.id) {
				posVec.current.copy(drag.position.current)
				anchorRef.current?.position.copy(posVec.current)
			}

			if (!wrapperRef.current) return

			if (hotspot.occlusionEnabled === false) {
				wrapperRef.current.style.opacity = '1'
				return
			}

			const origin = camera.position
			const target = posVec.current
			const distance = origin.distanceTo(target)

			occlusionRay.set(
				origin,
				occlusionDir.current.subVectors(target, origin).normalize()
			)

			const occluded = isHotspotOccluded(
				occlusionRay,
				modelRoot,
				distance,
				occlusionTolerance.current
			)
			wrapperRef.current.style.opacity = occluded ? '0.18' : '1'
		}, -1)

		const isLinkedCameraActive =
			!isHotspotToolActive &&
			!!hotspot.linkedCameraId &&
			hotspot.linkedCameraId === activeCameraId
		const accentColor =
			isSelected && isHotspotToolActive
				? '#f97316'
				: isLinkedCameraActive
					? 'var(--success)'
					: hotspot.visible
						? '#3b82f6'
						: '#6b7280'

		const showLabel = isSelected || hovered

		return (
			<group
				ref={anchorRef}
				position={hotspot.worldPosition as [number, number, number]}
			>
				<Html center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
					<div
						ref={wrapperRef}
						style={{
							pointerEvents: 'auto',
							transition: 'opacity 0.35s ease',
							position: 'relative',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center'
						}}
						onClick={(e) => {
							e.stopPropagation()
							if (isHotspotToolActive) {
								onSelect(hotspot.id)
							} else if (hotspot.linkedCameraId) {
								onActivateCamera(hotspot.linkedCameraId)
							}
						}}
						onMouseEnter={() => setHovered(true)}
						onMouseLeave={() => setHovered(false)}
					>
						{/* Pulsing circle */}
						<div
							className={isSelected ? 'vctrl-hp-selected' : 'vctrl-hp'}
							style={{
								width: 13,
								height: 13,
								borderRadius: '50%',
								background: accentColor,
								color: accentColor,
								border: '2px solid rgba(255,255,255,0.55)',
								boxSizing: 'border-box',
								cursor: 'pointer',
								flexShrink: 0
							}}
						/>

						{/* Floating label above the dot */}
						{showLabel && (
							<div
								style={{
									position: 'absolute',
									bottom: 'calc(100% + 7px)',
									left: '50%',
									transform: 'translateX(-50%)',
									fontSize: 11,
									lineHeight: 1.4,
									padding: '2px 8px',
									whiteSpace: 'nowrap',
									borderRadius: 4,
									background: 'rgba(0,0,0,0.82)',
									color: '#fff',
									backdropFilter: 'blur(6px)',
									border: '1px solid rgba(255,255,255,0.13)',
									pointerEvents: 'none',
									userSelect: 'none'
								}}
							>
								{hotspot.name || 'Hotspot'}
							</div>
						)}
					</div>
				</Html>
			</group>
		)
	}
)
HotspotDot.displayName = 'HotspotDot'

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
	drag: HotspotDragState
	onMove: (id: string, position: [number, number, number]) => void
}

const HotspotGizmo = memo(
	({ hotspot, grabbedRef, drag, onMove }: HotspotGizmoProps) => {
		const meshRef = useRef<THREE.Mesh>(null)
		const isDraggingRef = useRef(false)
		const { commandExecutor } = usePublisherViewerCapture()
		// TransformControls `object` prop requires the mesh to already be in the scene
		const [meshMounted, setMeshMounted] = useState(false)

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
			// Seeded before the id is published. three-stdlib dispatches `mouseDown`
			// with no `objectChange` - the first of those comes from a pointermove,
			// many frames later - so a marker that began following an unseeded
			// vector would sit at the world origin until the pointer moved.
			if (meshRef.current) drag.position.current.copy(meshRef.current.position)
			drag.hotspotId.current = hotspot.id
			commandExecutor.current?.execute({
				type: 'set_controls_enabled',
				enabled: false
			})
		}, [commandExecutor, drag, grabbedRef, hotspot.id])

		const handleDragEnd = useCallback(() => {
			isDraggingRef.current = false
			drag.hotspotId.current = null
			commandExecutor.current?.execute({
				type: 'set_controls_enabled',
				enabled: true
			})
			if (meshRef.current) {
				const p = meshRef.current.position
				onMove(hotspot.id, [p.x, p.y, p.z])
			}
		}, [commandExecutor, drag, hotspot.id, onMove])

		/**
		 * Publishes the drag rather than committing it.
		 *
		 * Committing here wrote `hotspotsAtom` on every frame, and the settings
		 * object rebuilt from that atom is the memo key for the unsaved-changes
		 * check - two full canonical serializations of every scene setting, twice
		 * per frame at 60fps, while every marker and the sidebar re-rendered. The
		 * position reaches the marker through a ref instead, and the atom is
		 * written once, on release.
		 */
		const handleObjectChange = useCallback(() => {
			if (!meshRef.current || !isDraggingRef.current) return
			drag.position.current.copy(meshRef.current.position)
		}, [drag])

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
			drag.hotspotId.current = null
			commandExecutor.current?.execute({
				type: 'set_controls_enabled',
				enabled: true
			})
			// Read the mesh, as `handleDragEnd` does: the published vector is a frame
			// old at best and never written at worst.
			const p = meshRef.current?.position
			if (p) onMove(hotspot.id, [p.x, p.y, p.z])
		}, [commandExecutor, drag, hotspot.id, onMove])

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

export const PublisherEditorScene = memo(() => {
	useHotspotStyles()

	const [hotspots, setHotspots] = useAtom(hotspotsAtom)
	const [activeHotspotId, setActiveHotspotId] = useAtom(activeHotspotIdAtom)
	const [isClickToPlaceActive, setIsClickToPlaceActive] = useAtom(
		isClickToPlaceActiveAtom
	)
	const process = useAtomValue(processAtom)
	const [selectedCameraId, setSelectedCameraId] = useAtom(selectedCameraIdAtom)
	const isHotspotToolActive = process.activeComposeTool === 'hotspots'
	const isPlacementArmed = isClickToPlaceActive && isHotspotToolActive
	// The object the viewer renders, and the only thing a hotspot anchors to.
	const { file } = useModelContext()
	const modelRoot = file?.model ?? null
	const gizmoGrabbedRef = useRef(false)
	const dragHotspotIdRef = useRef<null | string>(null)
	const dragPositionRef = useRef(new THREE.Vector3())
	const drag = useMemo<HotspotDragState>(
		() => ({ hotspotId: dragHotspotIdRef, position: dragPositionRef }),
		[]
	)
	/**
	 * Walks the whole model, so it is resolved once here rather than per marker
	 * per frame - and in a frame rather than in a memo.
	 *
	 * Normalization rescales an ancestor group without touching the model, so the
	 * size this measures changes without `modelRoot` doing so. A render-phase
	 * `useMemo` keyed on the normalization settings looks like it covers that and
	 * does not: R3F applies the new scale in the commit phase, after every
	 * render-phase memo in the same update, so the memo measures the previous
	 * scale and nothing recomputes it afterwards. On a large model clamped to a
	 * small one that leaves a slack wider than the whole model, and occlusion
	 * stops firing entirely. `SceneModel` solves its clipping sphere the same way,
	 * one file over.
	 *
	 * Priority -2 so the refresh lands before the markers read it at -1.
	 */
	const normalization = useAtomValue(normalizationAtom)
	const occlusionTolerance = useRef(0)
	const occlusionToleranceStale = useRef(true)

	useEffect(() => {
		occlusionToleranceStale.current = true
	}, [modelRoot, normalization])

	useFrame(() => {
		if (!occlusionToleranceStale.current) return
		const tolerance = resolveHotspotOcclusionTolerance(modelRoot)
		// Zero means the model has no geometry in the graph yet. Leave the slack as
		// it was and try again next frame rather than latching onto nothing.
		if (tolerance <= 0) return
		occlusionTolerance.current = tolerance
		occlusionToleranceStale.current = false
	}, -2)

	const handleSelectHotspot = useCallback(
		(id: string) => {
			setActiveHotspotId((prev) => (prev === id ? null : id))
		},
		[setActiveHotspotId]
	)

	const handleActivateHotspotCamera = useCallback(
		(cameraId: string) => {
			setSelectedCameraId(cameraId)
		},
		[setSelectedCameraId]
	)

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
			{hotspots.map((hotspot) => (
				<HotspotDot
					key={hotspot.id}
					hotspot={hotspot}
					isSelected={hotspot.id === activeHotspotId}
					isHotspotToolActive={isHotspotToolActive}
					activeCameraId={selectedCameraId ?? undefined}
					modelRoot={modelRoot}
					occlusionTolerance={occlusionTolerance}
					drag={drag}
					onSelect={handleSelectHotspot}
					onActivateCamera={handleActivateHotspotCamera}
				/>
			))}

			{isHotspotToolActive && activeHotspot && (
				<HotspotGizmo
					key={activeHotspot.id}
					hotspot={activeHotspot}
					grabbedRef={gizmoGrabbedRef}
					drag={drag}
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
