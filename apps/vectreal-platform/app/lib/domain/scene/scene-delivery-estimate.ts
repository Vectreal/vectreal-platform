/**
 * Turns a scene's byte size into the thing the viewer actually experiences.
 *
 * A raw megabyte count is uncalibrated for most people building a scene, which
 * is why it needed a label and a whole toolbar row to justify itself. An
 * estimated load time explains itself, and makes the case for optimizing
 * without having to nag.
 *
 * Isomorphic and dependency-free so it can be unit-tested directly.
 */

/**
 * Effective throughput assumed for the estimate, in bytes per second.
 *
 * Deliberately conservative. Nominal 4G peaks are far higher, but real-world
 * throughput on mobile after protocol overhead and contention lands closer to
 * this, and an estimate that flatters the scene would defeat the point.
 */
const ASSUMED_BYTES_PER_SECOND = 1_500_000

/** Shown alongside every estimate so the assumption is never implied silently. */
export const DELIVERY_REFERENCE_LABEL = '4G'

export const DELIVERY_ESTIMATE_EXPLANATION =
	`Rough estimate ${(ASSUMED_BYTES_PER_SECOND / 1_000_000).toFixed(1)} MB/s, ` +
	'with typical 4G connection. Load times can vary'

/**
 * Above this, a scene is slow enough that optimizing is worth surfacing.
 *
 * Chosen against the usual "3 seconds and they leave" guidance for page loads,
 * with headroom for the rest of the page to render around the model.
 */
const SLOW_LOAD_SECONDS = 2.5

export interface DeliveryEstimate {
	seconds: number
	/** Preformatted for display, e.g. "~1.2s" or "~7s". */
	label: string
	/** True once the load is slow enough to be worth flagging. */
	isSlow: boolean
}

/**
 * Formats to one decimal below 10 seconds and whole seconds above, so short
 * loads stay precise enough to show improvement while long ones stay readable.
 */
function formatSeconds(seconds: number): string {
	if (seconds < 10) {
		// Never round down to "~0.0s" — anything present takes some time.
		return `~${Math.max(seconds, 0.1).toFixed(1)}s`
	}
	return `~${Math.round(seconds)}s`
}

export function estimateDeliveryTime(
	sceneBytes: null | number | undefined
): DeliveryEstimate | null {
	if (
		typeof sceneBytes !== 'number' ||
		!Number.isFinite(sceneBytes) ||
		sceneBytes <= 0
	) {
		return null
	}

	const seconds = sceneBytes / ASSUMED_BYTES_PER_SECOND

	return {
		seconds,
		label: formatSeconds(seconds),
		isSlow: seconds > SLOW_LOAD_SECONDS
	}
}
