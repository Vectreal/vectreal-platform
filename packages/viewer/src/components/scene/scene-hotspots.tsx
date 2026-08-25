import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Raycaster, Vector3 } from 'three'

import HotspotMarker from './hotspot-marker'
import {
	OCCLUSION_INTERVAL_SECONDS,
	occlusionRayFar
} from './hotspot-occlusion'
import { resolveHotspotMarkers } from './resolve-hotspot-markers'

import type { HotspotDefinition } from '@vctrl/core'
import type { Object3D } from 'three'

const NO_OCCLUSIONS: ReadonlySet<string> = new Set()

export interface SceneHotspotsProps {
	hotspots?: HotspotDefinition[]
	/**
	 * The loaded model, and the only thing allowed to occlude a hotspot. Never
	 * the whole scene: it also holds the shadow catcher plane, which spans the
	 * model and sits between the camera and every hotspot below the horizon.
	 */
	model?: Object3D
	/** Draws `internalOnly` hotspots. Editing surfaces only. */
	includeInternal?: boolean
	/** Overrides the marker fill for every hotspot in this viewer. */
	color?: string
	onActivateCamera?: (cameraId: string) => void
}

/**
 * Draws a scene's hotspots over the model.
 *
 * Mounted at the scene root rather than inside `Center`, because a hotspot's
 * `worldPosition` is captured in world space by the authoring surface, after
 * both the centering offset and the normalization scale have been applied.
 * Nesting it under either transform would apply them a second time and every
 * marker would drift off the geometry it was placed on.
 *
 * Occlusion is computed here, once for every marker, rather than through drei's
 * `Html occlude` prop. drei tests the full camera-to-marker distance with no
 * tolerance, which a surface-mounted hotspot fails against its own triangle,
 * and it only re-tests when the camera moves, which strands a marker at its last
 * value when the author toggles the setting or the model animates underneath it.
 */
const SceneHotspots = ({
	hotspots,
	model,
	includeInternal,
	color,
	onActivateCamera
}: SceneHotspotsProps) => {
	const camera = useThree((state) => state.camera)
	const [occludedIds, setOccludedIds] =
		useState<ReadonlySet<string>>(NO_OCCLUSIONS)

	const markers = useMemo(
		() => resolveHotspotMarkers(hotspots, { includeInternal }),
		[hotspots, includeInternal]
	)

	const raycaster = useMemo(() => {
		const instance = new Raycaster()
		// Both default to a 1-unit radius, in world space, and both are radii
		// around the ray rather than hits on it. The viewer normalizes a model's
		// diagonal into [0.5, 5], so on a glTF carrying point-cloud or line
		// primitives every vertex in the scene would land inside that radius and
		// every hotspot would report itself permanently occluded.
		instance.params.Points.threshold = 0
		instance.params.Line.threshold = 0
		return instance
	}, [])
	const target = useRef(new Vector3())
	const direction = useRef(new Vector3())
	const elapsed = useRef(0)
	// Forces the next frame to re-test instead of waiting out the interval, so a
	// changed hotspot list or a swapped model never renders against stale state.
	const stale = useRef(true)

	// Keyed on what the pass actually reads, not on array identity: a caller that
	// rebuilds its hotspot array each render - which is the normal shape for
	// state-derived settings - would otherwise mark every render stale and
	// collapse the interval back to a full raycast per marker per frame.
	const inputs = markers
		.map(
			(marker) =>
				`${marker.id}:${marker.position.join()}:${marker.occlusionEnabled}`
		)
		.join('|')

	useEffect(() => {
		stale.current = true
	}, [inputs, model])

	useFrame((_state, delta) => {
		elapsed.current += delta
		if (!stale.current && elapsed.current < OCCLUSION_INTERVAL_SECONDS) return
		const forced = stale.current
		elapsed.current = 0
		stale.current = false

		const next = new Set<string>()

		if (model) {
			// r3f updates world matrices after every useFrame subscriber has run, and
			// `Center` writes its offset in a layout effect, so the pass forced by a
			// model swap would otherwise test against the previous placement.
			if (forced) model.updateWorldMatrix(true, true)

			for (const marker of markers) {
				if (!marker.occlusionEnabled) continue

				target.current.set(...marker.position)
				direction.current.subVectors(target.current, camera.position)
				const far = occlusionRayFar(direction.current.length())
				if (far === 0) continue

				raycaster.set(camera.position, direction.current.normalize())
				raycaster.near = 0
				raycaster.far = far
				// `set` leaves this null, unlike `setFromCamera`. `Sprite.raycast`
				// dereferences it, so a model containing one would throw here every
				// tick and take the render call for that frame with it.
				raycaster.camera = camera

				if (raycaster.intersectObject(model, true).length > 0) {
					next.add(marker.id)
				}
			}
		}

		// One state write for the whole set, and only when it actually changed:
		// this runs inside the frame loop, where a write per marker per tick would
		// re-render each marker's own portal root.
		setOccludedIds((previous) =>
			previous.size === next.size && [...next].every((id) => previous.has(id))
				? previous
				: next
		)
	})

	if (markers.length === 0) return null

	return (
		<>
			{markers.map((marker) => (
				<HotspotMarker
					key={marker.id}
					marker={marker}
					occluded={occludedIds.has(marker.id)}
					color={color}
					onActivate={onActivateCamera}
				/>
			))}
		</>
	)
}

export default SceneHotspots
