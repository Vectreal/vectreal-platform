import { resolveLighting } from '@vctrl/core'

import type { SceneSettings } from '@vctrl/core'
import type { ShadowBakeResult } from '@vctrl/viewer'

/**
 * What a saved scene is missing that only a browser can make, as stored. A
 * scene saved without a GPU, as an agent's is over v1, has neither: the
 * publisher's save captures the thumbnail from the opening camera and
 * persists a settled bake, so one save on first open fills both.
 *
 * A bake is asked for only with the ground on: off, the viewer bakes
 * nothing. Null when nothing is missing.
 */
export function planFirstOpenFill({
	thumbnailUrl,
	settings = {}
}: {
	thumbnailUrl?: string
	settings?: Pick<SceneSettings, 'lighting' | 'environment' | 'shadows'>
}): { thumbnail: boolean; bake: boolean } | null {
	const thumbnail = !thumbnailUrl
	const bake =
		resolveLighting(settings).ground.enabled && !settings.shadows?.baked
	return thumbnail || bake ? { thumbnail, bake } : null
}

/**
 * Waits until the viewer's bake capture has something to persist, polling
 * because the viewer reports no "settled" moment: the capture answers null
 * until the accumulative bake calibrates. Gives up after `timeoutMs`, so a
 * bake that never settles still lets the thumbnail be saved.
 *
 * True when the bake settled.
 */
export async function waitForSettledBake(
	capture: () => Promise<ShadowBakeResult | null>,
	{
		intervalMs = 500,
		timeoutMs = 30_000,
		isCancelled = () => false
	}: {
		intervalMs?: number
		timeoutMs?: number
		isCancelled?: () => boolean
	} = {}
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs
	while (!isCancelled()) {
		if (await capture().catch(() => null)) return true
		if (Date.now() + intervalMs > deadline) return false
		await new Promise((resolve) => setTimeout(resolve, intervalMs))
	}
	return false
}
