/**
 * The settings a save persists must describe the document it uploads. These
 * pin the three places that decide them without a pass: choosing the original,
 * reopening a saved scene, and restoring a draft.
 */
import { resolveDerivedSettings } from './optimization-inference'
import { inferOptimizationPreset } from './optimization-inference'
import { resolveRestoredDraftOptimization } from './scene-draft-persistence'
import { executeOptimizationStateHydration } from './scene-optimization-hydration'
import {
	balancedPreset,
	originalPreset,
	smallestPreset
} from '../../../../constants/optimizations'
import {
	optimizationInitialState,
	optimizationRuntimeInitialState
} from '../../../stores/scene-optimization-store'

import type { SceneManifestResponse } from '../../../../types/api'
import type { OptimizationState } from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'

describe('resolveDerivedSettings', () => {
	it('describes a pass that ran nothing by its source', () => {
		expect(resolveDerivedSettings(originalPreset, smallestPreset)).toBe(
			smallestPreset
		)
	})

	it('describes any other pass by its own settings', () => {
		expect(resolveDerivedSettings(balancedPreset, smallestPreset)).toBe(
			balancedPreset
		)
	})
})

function hydrate(stats: {
	optimizationSettings: Optimizations
	appliedOptimizations: string[]
}): OptimizationState {
	let state = optimizationInitialState
	executeOptimizationStateHydration({
		manifest: { stats } as unknown as SceneManifestResponse,
		calculateManifestReferencedBytes: () => ({
			sourcePackageBytes: null,
			textureBytes: null
		}),
		inferOptimizationPreset,
		setOptimizationState: (update) => {
			state = update(state)
		},
		setOptimizationRuntime: () => {},
		optimizationRuntimeInitialState,
		defaultOptimizations: balancedPreset
	})
	return state
}

describe('hydrating a saved scene', () => {
	it('treats a scene saved optimized as its own source', () => {
		const state = hydrate({
			optimizationSettings: smallestPreset,
			appliedOptimizations: ['texture compression']
		})

		expect(state.sourceSettings).toBe(smallestPreset)
		expect(state.derivedFrom).toBe(smallestPreset)
	})

	it('treats a scene saved as the original as the untouched upload', () => {
		const state = hydrate({
			optimizationSettings: originalPreset,
			appliedOptimizations: []
		})

		expect(state.sourceSettings).toBe(originalPreset)
		expect(state.derivedFrom).toBe(originalPreset)
	})

	// Choosing "Saved version" re-runs no step, so the applied-steps list a
	// save stores comes back empty while the textures are still the lossy ones.
	// The settings, not that list, say what the document is.
	it('keeps a saved version saved even when no step is recorded', () => {
		const state = hydrate({
			optimizationSettings: smallestPreset,
			appliedOptimizations: []
		})

		expect(state.sourceSettings).toBe(smallestPreset)
		expect(state.derivedFrom).toBe(smallestPreset)
	})
})

describe('resolveRestoredDraftOptimization', () => {
	it('starts presets from the original a draft carries', () => {
		expect(
			resolveRestoredDraftOptimization({
				optimizationSettings: smallestPreset,
				sourceGlb: new Uint8Array([1])
			})
		).toEqual({ sourceSettings: originalPreset, derivedFrom: smallestPreset })
	})

	it('treats an older draft without its original as its own source', () => {
		expect(
			resolveRestoredDraftOptimization({
				optimizationSettings: smallestPreset,
				sourceGlb: null
			})
		).toEqual({ sourceSettings: smallestPreset, derivedFrom: smallestPreset })
	})

	it('treats a draft without settings as the original', () => {
		expect(
			resolveRestoredDraftOptimization({
				optimizationSettings: null,
				sourceGlb: null
			})
		).toEqual({ sourceSettings: originalPreset, derivedFrom: originalPreset })
	})

	// A session that expires on a reopened saved version hands its saved
	// document over as the source; it must not come back as "original".
	it('keeps what the draft says its source embodies', () => {
		expect(
			resolveRestoredDraftOptimization({
				optimizationSettings: balancedPreset,
				sourceGlb: new Uint8Array([1]),
				sourceSettings: smallestPreset
			})
		).toEqual({ sourceSettings: smallestPreset, derivedFrom: balancedPreset })
	})
})
