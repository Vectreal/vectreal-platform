import type { HotspotDefinition } from '@vctrl/core'

/**
 * What a marker does when the model is in front of it: one choice in the
 * editor, two fields on the hotspot.
 *
 * Asked as one question because the second field only means something under
 * the first, and because the default - fade and stop taking clicks - is the
 * part authors trip over: a marker placed on the far side looks broken from
 * the front until someone turns the model. Showing all three outcomes side by
 * side is what tells the author the choice exists at all.
 */
export type OcclusionBehavior = 'show' | 'fade' | 'fade_clickable'

export const OCCLUSION_BEHAVIOR_OPTIONS: {
	value: OcclusionBehavior
	label: string
}[] = [
	{ value: 'show', label: 'Show' },
	{ value: 'fade', label: 'Fade' },
	{ value: 'fade_clickable', label: 'Fade, clickable' }
]

/** The choice a saved hotspot stands for, read with the viewer's defaults. */
export function occlusionBehaviorOf(
	hotspot: Pick<HotspotDefinition, 'clickableWhenOccluded' | 'occlusionEnabled'>
): OcclusionBehavior {
	if (hotspot.occlusionEnabled === false) return 'show'
	return hotspot.clickableWhenOccluded === true ? 'fade_clickable' : 'fade'
}

/** Both fields, always, so a choice never inherits half of the previous one. */
export function occlusionPatch(
	behavior: OcclusionBehavior
): Required<
	Pick<HotspotDefinition, 'clickableWhenOccluded' | 'occlusionEnabled'>
> {
	return {
		occlusionEnabled: behavior !== 'show',
		clickableWhenOccluded: behavior === 'fade_clickable'
	}
}

/** What a visitor gets, said for the marker being edited. */
export function describeOcclusionBehavior(
	behavior: OcclusionBehavior,
	hasCamera: boolean
): string {
	switch (behavior) {
		case 'show':
			return 'Drawn over the model from every side, and always clickable.'
		case 'fade':
			return 'Fades while the model is in front of it, and can’t be clicked until a visitor turns the model to see it.'
		case 'fade_clickable':
			return hasCamera
				? 'Fades while the model is in front of it, but stays clickable. A click flies its camera round to it. Try it in preview.'
				: 'Fades while the model is in front of it, but stays clickable. Link a camera so a click also brings it into view.'
	}
}
