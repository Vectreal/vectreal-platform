import {
	BoxGeometry,
	BufferGeometry,
	DoubleSide,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Points,
	PointsMaterial,
	Raycaster,
	Scene,
	SphereGeometry,
	Vector2,
	Vector3
} from 'three'
import { describe, expect, it } from 'vitest'

import {
	HOTSPOT_PLACEMENT_DRAG_TOLERANCE_PX,
	isHotspotOccluded,
	isHotspotPlacementGesture,
	prepareHotspotRaycaster,
	resolveHotspotAnchor,
	resolveHotspotOcclusionTolerance
} from './scene-hotspot-placement'

const WIDTH = 800
const HEIGHT = 500

/**
 * The publisher editor's scene graph, in the shape the viewer builds it.
 *
 * The model sits under `<Center top>` and `SceneModel`'s normalization scale
 * group; the shadow catcher and the gizmo plane are siblings. A unit sphere is
 * the model because a curved surface is what makes a flat plane parked on it
 * diverge from the geometry around the point it touches.
 *
 * The shadow catcher and the gizmo plane are here to be *hit*. A raycast scoped
 * to the model cannot observe either one, so the suites that care about them
 * resolve the same ray twice - against `model` and against `scene` - and assert
 * that the wide root reproduces the defect. Without that pairing both objects
 * would be decoration.
 */
function editorScene() {
	const scene = new Scene()

	const center = new Group()
	center.position.set(0, 1, 0)
	const normalizationScale = new Group()
	const model = new Group()
	model.add(new Mesh(new SphereGeometry(1, 128, 128), new MeshBasicMaterial()))
	normalizationScale.add(model)
	center.add(normalizationScale)
	scene.add(center)

	// drei ContactShadows / AccumulativeShadows / the loading shadow plane: all
	// untagged ground meshes the viewer mounts beneath the model.
	const shadowCatcher = new Mesh(
		new PlaneGeometry(20, 20),
		new MeshBasicMaterial()
	)
	shadowCatcher.rotation.x = -Math.PI / 2
	scene.add(shadowCatcher)

	// three-stdlib's TransformControlsPlane, which drei mounts with the gizmo:
	// PlaneGeometry(1e5, 1e5), material invisible, parked on the gizmo and kept
	// facing the camera while translating.
	// `DoubleSide` is copied from the real object rather than exercised: every ray
	// here meets the plane's front face.
	const gizmoPlane = new Mesh(
		new PlaneGeometry(1e5, 1e5, 2, 2),
		new MeshBasicMaterial({ visible: false, side: DoubleSide })
	)
	scene.add(gizmoPlane)

	const camera = new PerspectiveCamera(50, WIDTH / HEIGHT, 0.1, 1000)
	camera.position.set(0, 1, 5)
	camera.lookAt(0, 1, 0)

	/** Parks the gizmo on a placed hotspot, as TransformControls does. */
	const parkGizmoAt = (point: Vector3) => {
		gizmoPlane.position.copy(point)
		// Mirrors what TransformControls does while translating. This camera looks
		// straight down -z, so it is close to a no-op here; it is copied so the
		// fixture stays honest about the object it stands in for. The ray builders
		// below flush world matrices, so nothing needs flushing here.
		gizmoPlane.quaternion.copy(camera.quaternion)
	}

	const rayThrough = (px: number, py: number) => {
		camera.updateMatrixWorld(true)
		scene.updateMatrixWorld(true)
		const raycaster = prepareHotspotRaycaster(new Raycaster())
		raycaster.setFromCamera(
			new Vector2((px / WIDTH) * 2 - 1, -(py / HEIGHT) * 2 + 1),
			camera
		)
		return raycaster
	}

	const rayTowards = (marker: Vector3) => {
		camera.updateMatrixWorld(true)
		scene.updateMatrixWorld(true)
		const raycaster = prepareHotspotRaycaster(new Raycaster())
		raycaster.set(
			camera.position,
			marker.clone().sub(camera.position).normalize()
		)
		return raycaster
	}

	return {
		camera,
		model,
		normalizationScale,
		parkGizmoAt,
		rayThrough,
		rayTowards,
		scene
	}
}

/** Distance from a point to the surface of the unit sphere at [0, 1, 0]. */
const distanceFromModelSurface = (anchor: [number, number, number]): number =>
	Math.abs(new Vector3(...anchor).distanceTo(new Vector3(0, 1, 0)) - 1)

/**
 * A ray hits the sphere's triangles, not its ideal surface, so a correct anchor
 * still sits a faceting error inside it - up to about 3.7e-4 at 128 segments,
 * measured across the silhouette. The misplacements this suite is about are two
 * orders of magnitude larger than this bound.
 */
const ON_THE_SURFACE = 2e-3

/** A pixel over the front of the sphere, clear of its silhouette. */
const OVER_THE_MODEL: [number, number] = [460, 210]

describe('resolveHotspotAnchor', () => {
	/**
	 * The defect this module exists for, and the pairing that makes the rest of
	 * the suite mean something.
	 *
	 * `scene` is what the editor used to raycast, one level above the model. The
	 * gizmo's invisible 100,000-unit plane is nearer the camera than the surface
	 * under the pointer, so the anchor comes back off the model - while still
	 * projecting onto the clicked pixel, which is why it looked right until the
	 * camera moved.
	 */
	it('lands off the model when the root is widened past it', () => {
		const { model, parkGizmoAt, rayThrough, scene } = editorScene()

		parkGizmoAt(new Vector3(0, 1, 1))
		const ray = rayThrough(...OVER_THE_MODEL)

		const widened = resolveHotspotAnchor(ray, scene)

		expect(widened).not.toBeNull()
		expect(distanceFromModelSurface(widened!)).toBeGreaterThan(0.1)
		expect(resolveHotspotAnchor(ray, model)).not.toEqual(widened)
	})

	it('anchors on the model, not on the gizmo plane parked in front of it', () => {
		const { model, parkGizmoAt, rayThrough } = editorScene()

		// A hotspot already placed on the front of the sphere.
		parkGizmoAt(new Vector3(0, 1, 1))

		const anchor = resolveHotspotAnchor(rayThrough(...OVER_THE_MODEL), model)

		expect(anchor).not.toBeNull()
		expect(distanceFromModelSurface(anchor!)).toBeLessThan(ON_THE_SURFACE)
	})

	/**
	 * The shadow catchers are the same failure with no gizmo in the scene: a
	 * click just under the model used to snap the hotspot to y roughly 0, out on
	 * the ground plane, where nothing is drawn.
	 */
	it('returns nothing below the model, where the widened root finds the shadow catcher', () => {
		const { model, rayThrough, scene } = editorScene()

		const ray = rayThrough(400, 400)

		const widened = resolveHotspotAnchor(ray, scene)
		expect(widened).not.toBeNull()
		expect(widened![1]).toBeCloseTo(0, 6)

		expect(resolveHotspotAnchor(ray, model)).toBeNull()
	})

	it('returns nothing when the pointer is off the model', () => {
		const { model, parkGizmoAt, rayThrough } = editorScene()

		parkGizmoAt(new Vector3(0, 1, 1))

		expect(resolveHotspotAnchor(rayThrough(760, 60), model)).toBeNull()
	})

	it('returns nothing before a model is loaded', () => {
		const { rayThrough } = editorScene()

		expect(resolveHotspotAnchor(rayThrough(400, 250), null)).toBeNull()
	})

	it('reads through the offset and the scale between the model and the scene', () => {
		const { model, normalizationScale, rayThrough } = editorScene()

		// Normalization rescales an ancestor group rather than the glTF, so the
		// anchor has to be read in world space or it lands at the unscaled point.
		normalizationScale.scale.setScalar(2)

		const anchor = resolveHotspotAnchor(rayThrough(400, 250), model)

		expect(anchor).not.toBeNull()
		// <Center top> holds the sphere's centre at y = 1 and the scale group grows
		// its radius to 2, so the front face is at [0, 1, 2].
		expect(anchor![0]).toBeCloseTo(0, 5)
		expect(anchor![1]).toBeCloseTo(1, 5)
		expect(anchor![2]).toBeCloseTo(2, 5)
	})

	/**
	 * The replaced filter took `Mesh` and nothing else. Recursing the subtree
	 * picks up point and line primitives too, and three counts those as hit from
	 * a world unit away unless the thresholds are zeroed.
	 */
	it('ignores a stray point primitive floating in front of the surface', () => {
		const { model, rayThrough } = editorScene()

		const strayGeometry = new BufferGeometry()
		// Half a unit in front of the sphere's front face, dead on the ray, so any
		// threshold above zero claims it: three compares the radial distance with a
		// strict `<`.
		strayGeometry.setAttribute(
			'position',
			new Float32BufferAttribute([0, 1, 1.5], 3)
		)
		model.add(new Points(strayGeometry, new PointsMaterial()))

		const anchor = resolveHotspotAnchor(rayThrough(400, 250), model)

		expect(anchor).not.toBeNull()
		expect(distanceFromModelSurface(anchor!)).toBeLessThan(ON_THE_SURFACE)
	})
})

describe('isHotspotOccluded', () => {
	it('reports occluded when the root is widened past the model', () => {
		const { model, parkGizmoAt, rayTowards, scene } = editorScene()

		const marker = new Vector3(0, 1, 1)
		// The gizmo belongs to another hotspot, one the author dragged off to the
		// side. It is three units clear of this marker and still covers it, because
		// the plane is 100,000 units wide - which is why every marker in the scene
		// dimmed no matter where the gizmo sat.
		parkGizmoAt(new Vector3(3, 1, 2))
		const distance = 4
		const tolerance = resolveHotspotOcclusionTolerance(model)

		expect(
			isHotspotOccluded(rayTowards(marker), scene, distance, tolerance)
		).toBe(true)
		expect(
			isHotspotOccluded(rayTowards(marker), model, distance, tolerance)
		).toBe(false)
	})

	/**
	 * Pins the tolerance's lower bound. Half a percent of the radius stands in for
	 * the gizmo nudge, the largest of the three drifts the slack exists for and
	 * the one that sets this bound - storage rounding and Draco re-quantization
	 * are orders of magnitude smaller. Without slack the face the marker sits on
	 * reads as covering it.
	 */
	it('does not dim a marker sitting just inside the face it was placed on', () => {
		const { camera, model, rayThrough, rayTowards } = editorScene()

		const placed = resolveHotspotAnchor(rayThrough(...OVER_THE_MODEL), model)!
		const marker = new Vector3(...placed).lerp(new Vector3(0, 1, 0), 0.005)

		expect(
			isHotspotOccluded(
				rayTowards(marker),
				model,
				camera.position.distanceTo(marker),
				resolveHotspotOcclusionTolerance(model)
			)
		).toBe(false)
	})

	/**
	 * Pins the ceiling. A twentieth of the radius behind the near face is sunk,
	 * not seated, and slack wide enough to forgive that would stop a marker
	 * dimming when it is genuinely inside the model.
	 */
	it('dims a marker sunk a twentieth of the radius behind the near face', () => {
		const { camera, model, rayTowards } = editorScene()

		const marker = new Vector3(0, 1, 0.95)

		expect(
			isHotspotOccluded(
				rayTowards(marker),
				model,
				camera.position.distanceTo(marker),
				resolveHotspotOcclusionTolerance(model)
			)
		).toBe(true)
	})

	it('still reports geometry that genuinely covers the marker', () => {
		const { camera, model, rayTowards } = editorScene()

		// The far side of the sphere: the near face is in the way.
		const marker = new Vector3(0, 1, -1)

		expect(
			isHotspotOccluded(
				rayTowards(marker),
				model,
				camera.position.distanceTo(marker),
				resolveHotspotOcclusionTolerance(model)
			)
		).toBe(true)
	})

	/**
	 * `modelRoot` is `file?.model ?? null` and is genuinely null until the model
	 * loads. Answering `true` there would dim every marker permanently.
	 */
	it('reports nothing occluded before a model is loaded', () => {
		const { rayTowards } = editorScene()

		expect(
			isHotspotOccluded(rayTowards(new Vector3(0, 1, 1)), null, 4, 0.01)
		).toBe(false)
	})
})

describe('resolveHotspotOcclusionTolerance', () => {
	it('is nothing before a model is loaded', () => {
		expect(resolveHotspotOcclusionTolerance(null)).toBe(0)
	})

	/**
	 * A root carrying no geometry measures as an empty box, whose min is
	 * +Infinity and max -Infinity. Left alone that yields a negative slack, which
	 * widens the occlusion test instead of narrowing it.
	 */
	it('is nothing for a root with no geometry in it', () => {
		expect(resolveHotspotOcclusionTolerance(new Group())).toBe(0)
	})

	/**
	 * Pins the measure itself, not just how it scales. Without this the suite
	 * cannot tell the bounding-box diagonal from twice or half of it.
	 */
	it('is a fixed fraction of the bounding-box diagonal', () => {
		const cube = new Group()
		cube.add(new Mesh(new BoxGeometry(2, 4, 4), new MeshBasicMaterial()))

		// 2 x 4 x 4 has a diagonal of 6, and the slack is half a percent of it.
		// Spelled as a literal: writing the constant on both sides would pin the
		// shape of the measure while saying nothing about its value, and the two
		// behavioural tests either side only bracket it within a factor of ten.
		expect(resolveHotspotOcclusionTolerance(cube)).toBeCloseTo(0.03, 10)
	})

	it('measures the model as the world sees it, through every ancestor', () => {
		const { model, normalizationScale } = editorScene()

		const unscaled = resolveHotspotOcclusionTolerance(model)
		normalizationScale.scale.setScalar(3)

		expect(resolveHotspotOcclusionTolerance(model)).toBeCloseTo(unscaled * 3, 8)
	})

	/**
	 * The reason the slack is derived from the model rather than written in world
	 * units. Nothing bounds the size a scene arrives at - runtime normalization is
	 * off by default - so a constant that seats a marker on a unit model swallows
	 * a tenth of a model a tenth that size.
	 */
	it('scales with the model, so a tenth-size scene judges the same', () => {
		const small = editorScene()
		small.normalizationScale.scale.setScalar(0.1)
		small.camera.position.set(0, 1, 0.5)
		small.camera.lookAt(0, 1, 0)

		const tolerance = resolveHotspotOcclusionTolerance(small.model)
		expect(tolerance).toBeCloseTo(
			resolveHotspotOcclusionTolerance(editorScene().model) * 0.1,
			6
		)

		const seated = new Vector3(
			...resolveHotspotAnchor(small.rayThrough(...OVER_THE_MODEL), small.model)!
		).lerp(new Vector3(0, 1, 0), 0.005)
		// A twentieth of this model's radius, which is a two-hundredth of a unit.
		const sunk = new Vector3(0, 1, 0.095)

		expect(
			isHotspotOccluded(
				small.rayTowards(seated),
				small.model,
				small.camera.position.distanceTo(seated),
				tolerance
			)
		).toBe(false)

		expect(
			isHotspotOccluded(
				small.rayTowards(sunk),
				small.model,
				small.camera.position.distanceTo(sunk),
				tolerance
			)
		).toBe(true)
	})
})

describe('isHotspotPlacementGesture', () => {
	const gesture = (
		patch: Partial<Parameters<typeof isHotspotPlacementGesture>[0]>
	) => ({
		button: 0,
		// Deliberately different: with both at 100, reading `downX` where `downY`
		// belongs is unobservable, and a coordinate in the wrong place is the bug
		// class this whole module exists for.
		downX: 100,
		downY: 200,
		upX: 100,
		upY: 200,
		grabbedGizmo: false,
		...patch
	})

	it('accepts a primary-button click that did not travel', () => {
		expect(isHotspotPlacementGesture(gesture({}))).toBe(true)
	})

	/**
	 * Both bounds are spelled as literals rather than in terms of the constant.
	 * Written as `100 + TOLERANCE` these were true for every value, including
	 * zero - which rejects nearly every real click, since a click jitters.
	 */
	it('accepts a click that jittered by three pixels', () => {
		expect(isHotspotPlacementGesture(gesture({ upX: 103 }))).toBe(true)
	})

	/**
	 * Pointer coordinates are integers, so travelling exactly the tolerance is a
	 * real, common case sitting on the boundary the constant names.
	 */
	it('accepts a click that travelled exactly the tolerance', () => {
		expect(
			isHotspotPlacementGesture(
				gesture({ upX: 100 + HOTSPOT_PLACEMENT_DRAG_TOLERANCE_PX })
			)
		).toBe(true)
	})

	it('rejects a drag of five pixels', () => {
		expect(isHotspotPlacementGesture(gesture({ upX: 105 }))).toBe(false)
	})

	/**
	 * 3 across and 2 down is 3.6 as the crow flies but 5 by city block, so
	 * summing the axes instead would reject a click this accepts.
	 */
	it('measures travel as a straight line, not per axis', () => {
		expect(isHotspotPlacementGesture(gesture({ upX: 103, upY: 202 }))).toBe(
			true
		)
	})

	it('rejects a drag that travelled diagonally', () => {
		expect(isHotspotPlacementGesture(gesture({ upX: 104, upY: 204 }))).toBe(
			false
		)
	})

	it('rejects the secondary button, which OrbitControls pans with', () => {
		expect(isHotspotPlacementGesture(gesture({ button: 2 }))).toBe(false)
	})

	it('rejects the middle button', () => {
		expect(isHotspotPlacementGesture(gesture({ button: 1 }))).toBe(false)
	})

	/**
	 * The gizmo sits on the hotspot and the placement tool is armed at the same
	 * time. A nudge of a translate arrow is a sub-tolerance primary click, and
	 * the anchor under the arrow tip is nowhere near the hotspot being adjusted.
	 */
	it('rejects a nudge that grabbed a gizmo handle', () => {
		expect(isHotspotPlacementGesture(gesture({ grabbedGizmo: true }))).toBe(
			false
		)
	})
})

describe('prepareHotspotRaycaster', () => {
	it('zeroes the point and line thresholds that three defaults to one', () => {
		const raycaster = new Raycaster()

		expect(raycaster.params.Points.threshold).toBe(1)
		expect(raycaster.params.Line.threshold).toBe(1)

		prepareHotspotRaycaster(raycaster)

		expect(raycaster.params.Points.threshold).toBe(0)
		expect(raycaster.params.Line.threshold).toBe(0)
	})
})
