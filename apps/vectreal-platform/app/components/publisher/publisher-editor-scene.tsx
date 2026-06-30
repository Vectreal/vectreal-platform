import { Html, TransformControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtom, useAtomValue } from 'jotai/react'
import { memo, useCallback, useEffect, useRef, useState, type FC } from 'react'
import * as THREE from 'three'

import { PublisherViewCube } from './publisher-view-cube'
import { usePublisherViewerCapture } from './publisher-viewer-capture-context'
import {
	isClickToPlaceActiveAtom,
	processAtom
} from '../../lib/stores/publisher-config-store'
import {
	activeHotspotIdAtom,
	hotspotsAtom,
	selectedCameraIdAtom
} from '../../lib/stores/scene-settings-store'

import type { HotspotDefinition } from '@vctrl/core'

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

// ---------------------------------------------------------------------------
// 2-D hotspot dot rendered via drei Html (no 3-D geometry)
// ---------------------------------------------------------------------------

interface HotspotDotProps {
	hotspot: HotspotDefinition
	isSelected: boolean
	isHotspotToolActive: boolean
	activeCameraId?: string
	onSelect: (id: string) => void
	onActivateCamera: (cameraId: string) => void
}

const HotspotDot: FC<HotspotDotProps> = memo(
	({
		hotspot,
		isSelected,
		isHotspotToolActive,
		activeCameraId,
		onSelect,
		onActivateCamera
	}) => {
		const [hovered, setHovered] = useState(false)
		const wrapperRef = useRef<HTMLDivElement>(null)
		const posVec = useRef(new THREE.Vector3(...hotspot.worldPosition))
		const { camera, raycaster, scene } = useThree()

		// Keep position in sync with atom changes (e.g. after gizmo drag or click-to-place)
		useEffect(() => {
			posVec.current.set(...hotspot.worldPosition)
		}, [hotspot.worldPosition])

		// Occlusion: raycast from camera toward hotspot every frame, mutate opacity directly
		useFrame(() => {
			if (!wrapperRef.current) return

			if (!hotspot.occlusionEnabled) {
				wrapperRef.current.style.opacity = '1'
				return
			}

			const origin = camera.position
			const target = posVec.current
			const dist = origin.distanceTo(target)
			const dir = new THREE.Vector3().subVectors(target, origin).normalize()

			raycaster.set(origin, dir)

			const meshes: THREE.Mesh[] = []
			scene.traverse((o) => {
				if (o instanceof THREE.Mesh && !o.userData.editorOverlay) meshes.push(o)
			})

			const hits = raycaster.intersectObjects(meshes, true)
			const occluded = hits.length > 0 && hits[0].distance < dist - 0.05
			wrapperRef.current.style.opacity = occluded ? '0.18' : '1'
		})

		const isLinkedCameraActive =
			!isHotspotToolActive &&
			!!hotspot.linkedCameraId &&
			hotspot.linkedCameraId === activeCameraId
		const accentColor =
			isSelected && isHotspotToolActive
				? '#f97316'
				: isLinkedCameraActive
					? '#22c55e'
					: hotspot.visible
						? '#3b82f6'
						: '#6b7280'

		const showLabel = isSelected || hovered

		return (
			<Html
				center
				position={hotspot.worldPosition as [number, number, number]}
				zIndexRange={[100, 0]}
				style={{ pointerEvents: 'none' }}
			>
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
		)
	}
)
HotspotDot.displayName = 'HotspotDot'

// ---------------------------------------------------------------------------
// TransformControls gizmo for the active hotspot
// ---------------------------------------------------------------------------

interface HotspotGizmoProps {
	hotspot: HotspotDefinition
	onMove: (id: string, position: [number, number, number]) => void
}

const HotspotGizmo = memo(({ hotspot, onMove }: HotspotGizmoProps) => {
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
		commandExecutor.current?.execute({
			type: 'set_controls_enabled',
			enabled: false
		})
	}, [commandExecutor])

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
	}, [commandExecutor, hotspot.id, onMove])

	const handleObjectChange = useCallback(() => {
		if (!meshRef.current || !isDraggingRef.current) return
		const p = meshRef.current.position
		onMove(hotspot.id, [p.x, p.y, p.z])
	}, [hotspot.id, onMove])

	return (
		<>
			<mesh
				ref={(node) => {
					;(meshRef as React.MutableRefObject<THREE.Mesh | null>).current = node
					if (node && !meshMounted) setMeshMounted(true)
				}}
				position={hotspot.worldPosition as [number, number, number]}
				userData={{ editorOverlay: true }}
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
})
HotspotGizmo.displayName = 'HotspotGizmo'

// ---------------------------------------------------------------------------
// Click-to-place interceptor
// ---------------------------------------------------------------------------

interface ClickToPlaceProps {
	isActive: boolean
	activeHotspotId: string | null
	onPlace: (id: string, position: [number, number, number]) => void
}

function ClickToPlace({
	isActive,
	activeHotspotId,
	onPlace
}: ClickToPlaceProps) {
	const { raycaster, camera, scene, gl } = useThree()

	useEffect(() => {
		if (!isActive || !activeHotspotId) return

		const handlePointerDown = (e: PointerEvent) => {
			const canvas = gl.domElement
			const rect = canvas.getBoundingClientRect()
			const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
			const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

			raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

			const meshes: THREE.Object3D[] = []
			scene.traverse((obj) => {
				if (obj instanceof THREE.Mesh && !obj.userData.editorOverlay) {
					meshes.push(obj)
				}
			})

			const hits = raycaster.intersectObjects(meshes, false)
			if (hits.length > 0) {
				const p = hits[0].point
				onPlace(activeHotspotId, [p.x, p.y, p.z])
			}
		}

		gl.domElement.addEventListener('pointerdown', handlePointerDown)
		return () =>
			gl.domElement.removeEventListener('pointerdown', handlePointerDown)
	}, [isActive, activeHotspotId, camera, scene, raycaster, gl, onPlace])

	return null
}

// ---------------------------------------------------------------------------
// Main editor scene
// ---------------------------------------------------------------------------

export const PublisherEditorScene = memo(() => {
	useHotspotStyles()

	const [hotspots, setHotspots] = useAtom(hotspotsAtom)
	const [activeHotspotId, setActiveHotspotId] = useAtom(activeHotspotIdAtom)
	const isClickToPlaceActive = useAtomValue(isClickToPlaceActiveAtom)
	const process = useAtomValue(processAtom)
	const [selectedCameraId, setSelectedCameraId] = useAtom(selectedCameraIdAtom)
	const isHotspotToolActive = process.activeComposeTool === 'hotspots'

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

	const handlePlaceHotspot = useCallback(
		(id: string, position: [number, number, number]) => {
			setHotspots((prev) =>
				prev.map((h) => (h.id === id ? { ...h, worldPosition: position } : h))
			)
		},
		[setHotspots]
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
					onSelect={handleSelectHotspot}
					onActivateCamera={handleActivateHotspotCamera}
				/>
			))}

			{isHotspotToolActive && activeHotspot && (
				<HotspotGizmo
					key={activeHotspot.id}
					hotspot={activeHotspot}
					onMove={handleMoveHotspot}
				/>
			)}

			<ClickToPlace
				isActive={isClickToPlaceActive && isHotspotToolActive}
				activeHotspotId={activeHotspotId}
				onPlace={handlePlaceHotspot}
			/>

			<PublisherViewCube />
		</>
	)
})
PublisherEditorScene.displayName = 'PublisherEditorScene'
