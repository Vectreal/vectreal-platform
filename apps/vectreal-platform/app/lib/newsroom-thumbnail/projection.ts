/**
 * Software 3D projection for news-room scenes.
 *
 * Deliberately not a 3D engine: scenes emit line segments, renderers consume
 * them, and nothing here touches the DOM or Node so the same code runs at
 * build time, during prerender, and in the browser.
 */

export interface Vec3 {
	x: number
	y: number
	z: number
}

/** The only contract between a scene and a renderer. */
export interface Segment {
	x1: number
	y1: number
	x2: number
	y2: number
	opacity: number
	width: number
	accent: boolean
}

/** A segment that still knows its depth, for painter sorting before emit. */
export interface DepthSegment extends Segment {
	depth: number
}

export interface Camera {
	position: Vec3
	/** Radians about Y. */
	yaw: number
	/** Radians about X. Positive tilts the camera DOWN, raising the horizon. */
	pitch: number
	/** Vertical field of view in degrees. */
	fov: number
	near: number
}

export interface Viewport {
	width: number
	height: number
}

export interface Fog {
	near: number
	far: number
	power: number
}

export interface ProjectedPoint {
	x: number
	y: number
	depth: number
}

/** World space to camera space. The camera looks down -z, so depth is -z. */
export function toCameraSpace(point: Vec3, camera: Camera): Vec3 {
	const dx = point.x - camera.position.x
	const dy = point.y - camera.position.y
	const dz = point.z - camera.position.z

	const cosYaw = Math.cos(camera.yaw)
	const sinYaw = Math.sin(camera.yaw)
	const yawX = dx * cosYaw - dz * sinYaw
	const yawZ = dx * sinYaw + dz * cosYaw

	const cosPitch = Math.cos(camera.pitch)
	const sinPitch = Math.sin(camera.pitch)

	return {
		x: yawX,
		y: dy * cosPitch - yawZ * sinPitch,
		z: dy * sinPitch + yawZ * cosPitch
	}
}

/**
 * Clip a camera-space segment against the near plane.
 *
 * Returns null when the whole segment is behind it. Without this, rows that
 * straddle the near plane project into long streak artifacts across the frame.
 */
export function clipNear(a: Vec3, b: Vec3, near: number): [Vec3, Vec3] | null {
	const depthA = -a.z
	const depthB = -b.z
	const aheadA = depthA >= near
	const aheadB = depthB >= near

	if (!aheadA && !aheadB) {
		return null
	}

	if (aheadA && aheadB) {
		return [a, b]
	}

	const t = (near - depthA) / (depthB - depthA)
	const clipped: Vec3 = {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
		z: a.z + (b.z - a.z) * t
	}

	return aheadA ? [a, clipped] : [clipped, b]
}

/** Perspective divide into viewport pixels, y down. */
export function projectCameraSpace(
	point: Vec3,
	camera: Camera,
	viewport: Viewport
): ProjectedPoint {
	const depth = -point.z
	const focal = 1 / Math.tan((camera.fov * Math.PI) / 180 / 2)
	const aspect = viewport.width / viewport.height

	return {
		x:
			viewport.width / 2 +
			(focal / aspect) * (point.x / depth) * (viewport.width / 2),
		y: viewport.height / 2 - focal * (point.y / depth) * (viewport.height / 2),
		depth
	}
}

export function fogOpacity(depth: number, fog: Fog): number {
	const t = (depth - fog.near) / (fog.far - fog.near)

	if (t <= 0) {
		return 1
	}

	if (t >= 1) {
		return 0
	}

	return Math.pow(1 - t, fog.power)
}

/** Painter's algorithm: far segments first. */
export function sortByDepth(segments: DepthSegment[]): DepthSegment[] {
	return [...segments].sort((left, right) => right.depth - left.depth)
}
