import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Raycaster, Vector3 } from 'three'

import HotspotMarker from './hotspot-marker'
import {
	OCCLUSION_INTERVAL_SECONDS,
	occlusionRayFar
} from './hotspot-occlusion'
import { resolveHotspotMarkers } from './resolve-hotspot-markers'

import type { HotspotDefinition } from '@vctrl/core'
import type { Group, Object3D } from 'three'

const NO_OCCLUSIONS: ReadonlySet<string> = new Set()

/**
 * Moves a hotspot's marker without moving the hotspot.
 *
 * World space, the same frame `worldPosition` is stored in. Passing `null`
 * releases that hotspot's override; the marker then returns to whatever
 * `hotspots` says, whether or not the caller committed anything.
 *
 * The id and the position are published together, by one call, which is what
 * makes an override that names a hotspot but has nowhere to put it impossible
 * to express. Releasing is scoped to an id for the matching reason: a gizmo
 * torn down after a newer drag has already begun must not cancel that drag.
 */
export type HotspotPositionSetter = (
	id: string,
	position: [number, number, number] | null
) => void

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
	/** Draws hotspots the author hid, greyed. Editing surfaces only. */
	includeHidden?: boolean
	/** Overrides the marker fill for every hotspot in this viewer. */
	color?: string
	/** The marker drawn as the current one. */
	selectedId?: string | null
	onActivateCamera?: (cameraId: string) => void
	onSelect?: (id: string) => void
	onPositionSetterReady?: (setter: null | HotspotPositionSetter) => void
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
	includeHidden,
	color,
	selectedId,
	onActivateCamera,
	onSelect,
	onPositionSetterReady
}: SceneHotspotsProps) => {
	const camera = useThree((state) => state.camera)
	const invalidate = useThree((state) => state.invalidate)
	const [occludedIds, setOccludedIds] =
		useState<ReadonlySet<string>>(NO_OCCLUSIONS)

	const markers = useMemo(
		() => resolveHotspotMarkers(hotspots, { includeInternal, includeHidden }),
		[hotspots, includeInternal, includeHidden]
	)

	/**
	 * Where the gizmo is while a drag is in flight, and whose drag it is.
	 *
	 * Refs rather than state, and the whole reason this path exists: a drag emits
	 * a position every frame, and routing sixty of those a second through React
	 * would re-render every marker's portal and, on the platform's publisher,
	 * re-serialize every scene setting twice per frame.
	 */
	const overrideId = useRef<string | null>(null)
	const overridePosition = useRef(new Vector3())
	/**
	 * A released hotspot whose anchor still has to be put back where stored state
	 * says, handled on the next frame rather than inside the release itself.
	 *
	 * Both halves matter. Without it, releasing leaves the anchor wherever the
	 * drag left it: R3F skips `applyProps` when a `position` array is
	 * element-wise equal to the last one it rendered, and it diffs against that
	 * remembered prop rather than against the object, so a position the caller
	 * never changed can never pull an imperatively-moved anchor back. The
	 * re-seat effect below covers the case where the list changes; a release that
	 * commits nothing changes nothing, and that is exactly what an interrupted
	 * drag does when the gizmo's mesh is detached before its cleanup runs.
	 *
	 * Deferring to the next frame is what keeps the ordinary path from flickering:
	 * a commit is scheduled before the release but flushed after it, so reading
	 * stored state during the release would find the pre-drag position and snap
	 * the marker back to it for a beat. By the next frame it has landed, and the
	 * frame callback reads `markers` from its own closure - R3F refreshes that in
	 * a layout effect, so it is never behind a passive one.
	 */
	const pendingReseat = useRef(new Set<string>())

	/**
	 * The anchor group each drawn marker registers by callback ref. A marker that
	 * unmounts mid-drag deregisters itself, and the frame write below then finds
	 * nothing - which is the correct thing for it to find.
	 */
	const anchors = useRef(new Map<string, Group>())

	const registerAnchor = useCallback((id: string, node: Group | null) => {
		if (node) anchors.current.set(id, node)
		else anchors.current.delete(id)
	}, [])

	const setHotspotPosition = useCallback<HotspotPositionSetter>(
		(id, position) => {
			if (position === null) {
				if (overrideId.current === id) {
					overrideId.current = null
					pendingReseat.current.add(id)
				}
				// Under `frameloop="demand"` nothing else would ask for the frame that
				// puts this marker back: a release that commits nothing produces no
				// React update, so no render is scheduled either.
				invalidate()
				return
			}
			overrideId.current = id
			overridePosition.current.set(position[0], position[1], position[2])
			pendingReseat.current.delete(id)
			invalidate()
		},
		[invalidate]
	)

	useEffect(() => {
		onPositionSetterReady?.(setHotspotPosition)
		return () => onPositionSetterReady?.(null)
	}, [onPositionSetterReady, setHotspotPosition])

	/**
	 * Re-seats every anchor from stored state whenever the drawn list changes.
	 *
	 * A drag writes these positions outside React, and R3F only re-applies a
	 * `position` prop it sees change between renders - so a commit that happens
	 * to land on the value the anchor already holds would leave it stuck at the
	 * drag position for good.
	 *
	 * The marker being dragged is skipped: an unrelated edit landing mid-drag, a
	 * rename typed in a sidebar, would otherwise snap it back to wherever the
	 * author picked it up.
	 */
	useEffect(() => {
		// A hotspot that leaves the list mid-drag takes its override with it.
		// Otherwise a marker that later remounts under the same id - a consumer
		// toggling `includeHidden`, say - would be yanked to the stale position on
		// its first frame.
		if (
			overrideId.current &&
			!markers.some((marker) => marker.id === overrideId.current)
		) {
			pendingReseat.current.delete(overrideId.current)
			overrideId.current = null
		}

		for (const marker of markers) {
			if (marker.id === overrideId.current) continue
			anchors.current.get(marker.id)?.position.set(...marker.position)
		}
	}, [markers])

	/**
	 * Puts the dragged marker where the gizmo is, before anything projects from
	 * it.
	 *
	 * Priority -1 is load-bearing. drei's `Html` subscribes at priority 0 and
	 * calls `updateWorldMatrix(true, false)`, which recomputes each ancestor's
	 * local matrix from its `position` - so a plain `.position.copy()` on this
	 * group lands in the same frame, provided it happened first. R3F sorts
	 * subscribers ascending and, at equal priority, a child subscribes before its
	 * parent, so at 0 the `Html` would project before this write and the marker
	 * would trail the gizmo by a frame. Only a positive priority takes the render
	 * loop over, so a negative one costs nothing.
	 */
	useFrame(() => {
		const id = overrideId.current
		if (id) anchors.current.get(id)?.position.copy(overridePosition.current)

		// Deliberately not behind the `if` above: a marker released while a
		// different one is being dragged would otherwise wait for that drag to end,
		// and the single slot this used to be would have lost it by then.
		for (const released of pendingReseat.current) {
			// Picked up again before this ran; its override owns the anchor now.
			if (released === id) continue
			pendingReseat.current.delete(released)
			const marker = markers.find((entry) => entry.id === released)
			if (marker)
				anchors.current.get(released)?.position.set(...marker.position)
		}
	}, -1)

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
	const lastOverrideId = useRef<string | null>(null)

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
		// Both edges of a drag re-test on the next frame rather than waiting out
		// the interval. The release edge is usually covered by `inputs` changing,
		// but not for a drag that ends exactly where it started.
		if (overrideId.current !== lastOverrideId.current) {
			lastOverrideId.current = overrideId.current
			stale.current = true
		}

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
				/*
				  The marker being dragged is left un-occluded for the whole gesture.

				  Its stored position is deliberately not being rewritten yet, so the
				  only point this pass could test is the one the author already
				  dragged away from. There is no true answer mid-gesture, and the
				  useful rendering of "unknown" is "visible": the author is looking
				  straight at the thing they are dragging, and fading it to 15% under
				  a `TransformControls` gizmo that stays fully drawn is the worst
				  reading available. Truth returns on the frame after release.
				*/
				if (marker.id === overrideId.current) continue

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
					selected={marker.id === selectedId}
					color={color}
					onActivate={onActivateCamera}
					onSelect={onSelect}
					onAnchorRef={registerAnchor}
				/>
			))}
		</>
	)
}

export default SceneHotspots
