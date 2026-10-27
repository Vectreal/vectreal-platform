import { describe, expect, it } from 'vitest'

import {
	describeOcclusionBehavior,
	OCCLUSION_BEHAVIOR_OPTIONS,
	occlusionBehaviorOf,
	occlusionPatch
} from './occlusion-behavior'

describe('occlusionBehaviorOf', () => {
	it('reads a hotspot saved before either field existed as an inert fade', () => {
		expect(occlusionBehaviorOf({})).toBe('fade')
	})

	it('reads occlusion off as shown, whatever the clickable flag says', () => {
		expect(
			occlusionBehaviorOf({
				occlusionEnabled: false,
				clickableWhenOccluded: true
			})
		).toBe('show')
	})

	it('reads a clickable fade', () => {
		expect(
			occlusionBehaviorOf({
				occlusionEnabled: true,
				clickableWhenOccluded: true
			})
		).toBe('fade_clickable')
	})
})

describe('occlusionPatch', () => {
	it.each(OCCLUSION_BEHAVIOR_OPTIONS.map((option) => option.value))(
		'reads back as the %s it wrote',
		(behavior) => {
			expect(occlusionBehaviorOf(occlusionPatch(behavior))).toBe(behavior)
		}
	)

	it('clears the clickable flag when the marker stops fading', () => {
		expect(occlusionPatch('show')).toEqual({
			occlusionEnabled: false,
			clickableWhenOccluded: false
		})
	})
})

describe('describeOcclusionBehavior', () => {
	it('says an inert fade cannot be clicked', () => {
		expect(describeOcclusionBehavior('fade', true)).toMatch(/can’t be clicked/)
	})

	it('asks for a camera when a clickable fade has none to bring it into view', () => {
		expect(describeOcclusionBehavior('fade_clickable', false)).toMatch(
			/Link a camera/
		)
		expect(describeOcclusionBehavior('fade_clickable', true)).not.toMatch(
			/Link a camera/
		)
	})
})
