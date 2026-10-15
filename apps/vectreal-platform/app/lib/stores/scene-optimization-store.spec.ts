/**
 * A save, a draft and the publish-time Draco repack describe the document on
 * screen. The panel's settings can run ahead of it: edits in the advanced
 * controls are not applied until the user applies them.
 */
import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

import {
	documentOptimizationsAtom,
	optimizationAtom,
	optimizationInitialState
} from './scene-optimization-store'
import { balancedPreset, smallestPreset } from '../../constants/optimizations'

describe('documentOptimizationsAtom', () => {
	it('is what the document was derived from, not what the panel shows', () => {
		const store = createStore()
		store.set(optimizationAtom, {
			...optimizationInitialState,
			optimizations: balancedPreset,
			derivedFrom: smallestPreset
		})

		expect(store.get(documentOptimizationsAtom)).toBe(smallestPreset)
	})
})

// A fresh scene stays as uploaded until a preset is chosen. Staging another
// preset would mark it chosen in the panel while it never ran, and choosing
// it there would then do nothing.
describe('optimizationInitialState', () => {
	it('stages what is shown', () => {
		expect(optimizationInitialState.optimizationPreset).toBe('original')
		expect(optimizationInitialState.optimizations).toBe(
			optimizationInitialState.derivedFrom
		)
	})
})
