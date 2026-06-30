import { Line, PivotControls } from '@react-three/drei'
import { ThreeEvent, useThree } from '@react-three/fiber'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Group, Matrix4, Object3D, Vector3 } from 'three'

interface ShadowLightGizmoProps {
	/** World-space position of the light handle. */
	position: [number, number, number]
	/** Closest the light may sit to the target, keeping it outside the model. */
	minDistance?: number
	/** Called with the new world-space handle position while dragging. */
	onChange: (worldPosition: [number, number, number]) => void
	/** Fired when a drag begins / ends (used to drop to a fast preview bake). */
	onDragStart?: () => void
	onDragEnd?: () => void
}

// Keep the light at least this far above the horizon (as a fraction of its
// distance from the target) so it can't be dragged below the ground plane.
const MIN_ELEVATION_SIN = Math.sin((6 * Math.PI) / 180)

const scratch = new Vector3()
const ORIGIN: [number, number, number] = [0, 0, 0]

/**
 * In-viewport control for the shadow light.
 *
 * - A thin line from the model base to the light always shows the light
 *   direction, so the light stays locatable even when its handle is off-screen.
 * - A small marker sits at the light; clicking it toggles the move gizmo
 *   (editor-style click-to-activate) rather than leaving arrows permanently on.
 * - When active, drag the X/Y/Z arrows to aim the light. The handle is a constant
 *   on-screen size (PivotControls `fixed`) so it never balloons off-screen.
 *
 * PivotControls (pure r3f) is used over TransformControls, which throws from its
 * gizmo's updateMatrixWorld when the accumulative bake re-renders the tree.
 */
const ShadowLightGizmo = ({
	position,
	minDistance = 0,
	onChange,
	onDragStart,
	onDragEnd
}: ShadowLightGizmoProps) => {
	const controls = useThree(
		(state) => state.controls as { enabled?: boolean } | null
	)
	const [active, setActive] = useState(false)
	const [hovered, setHovered] = useState(false)
	// Live (uncommitted) position during a drag, so the direction line tracks the
	// handle smoothly instead of lagging behind the debounced store commit.
	const [livePosition, setLivePosition] = useState<
		[number, number, number] | null
	>(null)

	const groupRef = useRef<Group>(null)

	// The accumulative bake treats every shadow-casting mesh in the scene as an
	// occluder, including these helper meshes (the marker, the direction line, and
	// drei's internal PivotControls arrows), which would bake a hard streak/disc
	// onto the ground. Force the whole gizmo subtree to never cast. Runs every
	// render so meshes created later (the arrows appear only when active) are
	// covered too.
	useLayoutEffect(() => {
		groupRef.current?.traverse((object: Object3D) => {
			object.castShadow = false
		})
	})

	const matrix = useMemo(
		() => new Matrix4().setPosition(position[0], position[1], position[2]),
		[position]
	)
	const distance = useMemo(
		() => Math.hypot(position[0], position[1], position[2]) || 1,
		[position]
	)
	const markerRadius = distance * 0.03

	const handleDrag = useCallback(
		(local: Matrix4) => {
			scratch.setFromMatrixPosition(local)
			// Keep the light above the ground...
			const minY = scratch.length() * MIN_ELEVATION_SIN
			if (scratch.y < minY) scratch.y = minY
			// ...and outside the model, so it never ends up inside the geometry
			// (which would leave the model in front of the shadow camera's near plane
			// and cast no shadow).
			if (minDistance > 0 && scratch.length() < minDistance) {
				scratch.setLength(minDistance)
			}
			const next: [number, number, number] = [scratch.x, scratch.y, scratch.z]
			setLivePosition(next)
			onChange(next)
		},
		[minDistance, onChange]
	)

	const handleDragStart = useCallback(() => {
		if (controls) controls.enabled = false
		onDragStart?.()
	}, [controls, onDragStart])

	const handleDragEnd = useCallback(() => {
		if (controls) controls.enabled = true
		setLivePosition(null)
		onDragEnd?.()
	}, [controls, onDragEnd])

	const toggleActive = useCallback((event: ThreeEvent<MouseEvent>) => {
		event.stopPropagation()
		setActive((value) => !value)
	}, [])

	const markerColor = active ? '#ffcf6b' : hovered ? '#ffd98a' : '#f4f4f5'
	const lineEnd = livePosition ?? position

	const marker = (
		<mesh
			onClick={toggleActive}
			onPointerOver={(event) => {
				event.stopPropagation()
				setHovered(true)
			}}
			onPointerOut={() => setHovered(false)}
		>
			<sphereGeometry args={[markerRadius, 16, 16]} />
			<meshBasicMaterial color={markerColor} toneMapped={false} depthTest={false} />
		</mesh>
	)

	return (
		<group ref={groupRef}>
			<Line
				points={[ORIGIN, lineEnd]}
				color="#ffcf6b"
				lineWidth={1}
				transparent
				opacity={0.35}
				depthTest={false}
			/>
			{active ? (
				<PivotControls
					matrix={matrix}
					autoTransform
					fixed
					scale={95}
					disableRotations
					disableScaling
					disableSliders
					depthTest={false}
					lineWidth={2.5}
					onDragStart={handleDragStart}
					onDrag={handleDrag}
					onDragEnd={handleDragEnd}
				>
					{marker}
				</PivotControls>
			) : (
				<group position={position}>{marker}</group>
			)}
		</group>
	)
}

export default ShadowLightGizmo
