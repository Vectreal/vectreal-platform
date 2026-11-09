export interface Tap {
	time: number
	x: number
	y: number
}

/** Longest gap between two taps that still reads as one double-tap. */
export const DOUBLE_TAP_MS = 300
/** Longest a finger may rest and still be a tap rather than a press. */
export const TAP_MS = 300
/**
 * How far a finger may move and still be a tap, and how far apart two taps
 * may land: a finger is a blunt pointer.
 */
export const TAP_SLOP_PX = 24

const within = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.hypot(a.x - b.x, a.y - b.y) <= TAP_SLOP_PX

/**
 * A finger lifted soon and where it went down: not the end of a drag, and not
 * a long press.
 */
export function isTap(down: Tap, up: Tap): boolean {
	return up.time - down.time <= TAP_MS && within(down, up)
}

/**
 * Whether `tap` completes a double-tap begun by `previous`.
 *
 * Detected from pointer events rather than `dblclick`, which Safari on iPhone
 * does not reliably send for a double-tap.
 */
export function isDoubleTap(previous: Tap | null, tap: Tap): boolean {
	return (
		previous !== null &&
		tap.time - previous.time <= DOUBLE_TAP_MS &&
		within(previous, tap)
	)
}
