import { useLayoutEffect } from 'react'
import { Frustum, Matrix4, PerspectiveCamera, Sphere, Vector3 } from 'three'

/**
 * Something the viewer draws besides the model, in world space, that the
 * camera's clip range has to contain: a flat piece of the stage such as the
 * shadow ground (a convex planar polygon), or a handle (a sphere).
 */
export type ClipExtent =
	| {
			kind: 'sphere'
			center: Vector3
			radius: number
			/**
			 * Extra reach in CSS pixels, for parts drawn at a fixed size on screen
			 * (the light handle's move arrows), whose world size grows with depth.
			 */
			screenRadius?: number
	  }
	| { kind: 'polygon'; corners: readonly Vector3[] }

/**
 * The extents currently drawn. Each drawing component adds its own while it is
 * mounted (`useClipExtents`); the clip-plane owner reads them every frame.
 */
export type ClipExtentRegistry = Set<readonly ClipExtent[]>

/**
 * Registers `extents` for as long as the caller is mounted and keeps passing
 * the same array. Callers memoize the array, so a registration changes only
 * when what they draw does.
 */
export const useClipExtents = (
	registry: ClipExtentRegistry | undefined,
	extents: readonly ClipExtent[] | null
) => {
	useLayoutEffect(() => {
		if (!registry || !extents) return
		registry.add(extents)
		return () => {
			registry.delete(extents)
		}
	}, [registry, extents])
}

// Fraction of depth left in front of the nearest content and behind the
// farthest, so nothing grazing a plane flickers in and out.
const DEPTH_MARGIN = 0.1

const viewProjection = new Matrix4()
const frustum = new Frustum()
const eye = new Vector3()
const forward = new Vector3()
const offset = new Vector3()

/** Sutherland-Hodgman: the part of a convex polygon on the inside of `plane`. */
const clipPolygon = (
	corners: readonly Vector3[],
	plane: Frustum['planes'][number]
): Vector3[] => {
	const inside: Vector3[] = []
	for (let i = 0; i < corners.length; i++) {
		const a = corners[i]
		const b = corners[(i + 1) % corners.length]
		const da = plane.distanceToPoint(a)
		const db = plane.distanceToPoint(b)
		if (da >= 0) inside.push(a)
		if (da >= 0 !== db >= 0) inside.push(a.clone().lerp(b, da / (da - db)))
	}
	return inside
}

/**
 * Near and far planes that contain the model and everything else the viewer
 * draws, as tight as that allows.
 *
 * Depth is measured along the view direction, which is what the planes cut.
 * A polygon is first clipped to the frustum's four sides, so a ground plane
 * that runs under the camera bounds the near plane where it enters the view
 * rather than behind the camera. A staged sphere outside the view is ignored.
 * `model` is also the scale reference for the near-plane floor.
 * `viewportHeight` is the canvas height in CSS pixels, which `screenRadius`
 * is measured in.
 */
export const resolveClipPlanes = (
	camera: PerspectiveCamera,
	model: Sphere,
	staged: Iterable<readonly ClipExtent[]>,
	viewportHeight: number
): { near: number; far: number } => {
	camera.updateMatrixWorld()
	eye.setFromMatrixPosition(camera.matrixWorld)
	camera.getWorldDirection(forward)
	frustum.setFromProjectionMatrix(
		viewProjection.multiplyMatrices(
			camera.projectionMatrix,
			camera.matrixWorldInverse
		)
	)

	const depthOf = (point: Vector3) => offset.subVectors(point, eye).dot(forward)
	// The model always counts, so both ends stay finite.
	const modelDepth = depthOf(model.center)
	let nearest = modelDepth - model.radius
	let farthest = modelDepth + model.radius
	// World length of one CSS pixel at unit depth.
	const pixelAtUnitDepth =
		(2 * Math.tan((camera.fov * Math.PI) / 360)) /
		(camera.zoom * Math.max(viewportHeight, 1))

	for (const extents of staged) {
		for (const extent of extents) {
			if (extent.kind === 'sphere') {
				const depth = depthOf(extent.center)
				const radius =
					extent.radius +
					(extent.screenRadius ?? 0) * pixelAtUnitDepth * Math.max(depth, 0)
				// The four side planes; 4 and 5 are the current far and near.
				let visible = depth + radius > 0
				for (let i = 0; i < 4 && visible; i++) {
					visible = frustum.planes[i].distanceToPoint(extent.center) > -radius
				}
				if (!visible) continue
				nearest = Math.min(nearest, depth - radius)
				farthest = Math.max(farthest, depth + radius)
				continue
			}
			let visible: readonly Vector3[] = extent.corners
			for (let i = 0; i < 4 && visible.length > 0; i++) {
				visible = clipPolygon(visible, frustum.planes[i])
			}
			for (const corner of visible) {
				const depth = depthOf(corner)
				nearest = Math.min(nearest, depth)
				farthest = Math.max(farthest, depth)
			}
		}
	}

	const floor = Math.max(model.radius * 0.001, 1e-4)
	const near = Math.max(nearest * (1 - DEPTH_MARGIN), floor)
	const far = Math.max(farthest * (1 + DEPTH_MARGIN), near + floor)
	return { near, far }
}
